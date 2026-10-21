import { expect, it } from "vitest";
import { checkoutSchema } from "./checkout";
const checkout = {
  customerName: "Comprador Teste",
  customerEmail: "buyer@example.test",
  customerPhone: "11999999999",
  customerTaxId: "19119119100",
  postalCode: "01001000",
  street: "Rua Teste",
  number: "1",
  neighborhood: "Centro",
  city: "São Paulo",
  state: "SP",
  paymentMethodId: "pix",
  checkoutIdempotencyKey: "00000000-0000-4000-8000-000000000001",
  shippingSelections: "{}",
};
it("keeps Pix compatible without card data", () => {
  expect(checkoutSchema.safeParse(checkout).success).toBe(true);
});
it("accepts a tokenized credit card without accepting raw card data", () => {
  const result = checkoutSchema.parse({
    ...checkout,
    paymentMethodId: "visa",
    paymentToken: "a".repeat(32),
    issuerId: "25",
    cardNumber: "not-accepted",
    cvv: "not-accepted",
    installments: 12,
  });
  expect(result).not.toHaveProperty("cardNumber");
  expect(result).not.toHaveProperty("cvv");
  expect(result).not.toHaveProperty("installments");
});
it.each([
  { paymentMethodId: "visa" },
  { paymentMethodId: "pix", paymentToken: "a".repeat(32) },
  { paymentMethodId: "visa", paymentToken: "invalid" },
  { paymentMethodId: "bolbradesco", paymentToken: "a".repeat(32) },
])("rejects incomplete or inconsistent payment data %j", (payment) => {
  expect(checkoutSchema.safeParse({ ...checkout, ...payment }).success).toBe(false);
});
it("normalizes the customer e-mail so coupon limits cannot be bypassed by casing", () => {
  const result = checkoutSchema.parse({ ...checkout, customerEmail: "  Buyer@Example.TEST " });
  expect(result.customerEmail).toBe("buyer@example.test");
});
it.each([{ state: "S1" }, { state: "XX" }])("rejects a state that is not a Brazilian UF %j", (address) => {
  const result = checkoutSchema.safeParse({ ...checkout, ...address });
  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe("Informe a UF.");
});
it("normalizes a lowercase UF", () => {
  expect(checkoutSchema.parse({ ...checkout, state: " sp " }).state).toBe("SP");
});
it.each([
  { street: "x".repeat(161) },
  { number: "1".repeat(21) },
  { neighborhood: "x".repeat(101) },
  { city: "x".repeat(101) },
])("bounds the address snapshot like saved addresses %j", (address) => {
  expect(checkoutSchema.safeParse({ ...checkout, ...address }).success).toBe(false);
});
it("stores the masked phone as digits and refuses an incomplete one", () => {
  expect(checkoutSchema.parse({ ...checkout, customerPhone: "(11) 98765-4321" }).customerPhone).toBe("11987654321");
  expect(checkoutSchema.safeParse({ ...checkout, customerPhone: "(11) 9876" }).success).toBe(false);
});
