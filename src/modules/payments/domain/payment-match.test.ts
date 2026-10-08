import { describe, expect, it } from "vitest";
import { assertPaymentMatches } from "./payment-match";

const payment = {
  externalId: "mp-1",
  amountInCents: 1099,
  currency: "BRL",
  method: "pix",
  order: { orderNumber: "MS-1" },
};
const result = {
  externalId: "mp-1",
  status: "APPROVED" as const,
  providerMetadata: {
    transaction_amount: 10.99,
    currency_id: "BRL",
    payment_method_id: "pix",
    external_reference: "MS-1",
  },
};

describe("payment reconciliation identity", () => {
  it("accepts matching integer-cent value despite binary decimal precision", () => {
    expect(() => assertPaymentMatches(payment, result)).not.toThrow();
  });
  it.each([
    { transaction_amount: 1 },
    { transaction_amount: null },
    { transaction_amount: NaN },
    { transaction_amount: Infinity },
    { transaction_amount: "10.99" },
    { currency_id: "USD" },
    { payment_method_id: "visa" },
    { external_reference: "OTHER" },
  ])("rejects mismatched or invalid metadata %j", (patch) => {
    expect(() =>
      assertPaymentMatches(payment, { ...result, providerMetadata: { ...result.providerMetadata, ...patch } }),
    ).toThrow("revisão");
  });
  it("rejects a different provider payment", () => {
    expect(() => assertPaymentMatches(payment, { ...result, externalId: "other" })).toThrow();
  });
});
