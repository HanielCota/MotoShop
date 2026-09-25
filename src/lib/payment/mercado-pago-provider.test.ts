import { afterEach, expect, it, vi } from "vitest";
const paymentEnv = vi.hoisted(() => ({
  MERCADO_PAGO_ACCESS_TOKEN: "TEST_TOKEN",
  MERCADO_PAGO_API_URL: "https://api.mercadopago.com",
  MERCADO_PAGO_NOTIFICATION_URL: undefined as string | undefined,
  MERCADO_PAGO_WEBHOOK_SECRET: undefined as string | undefined,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({
  env: paymentEnv,
}));

import { MercadoPagoProvider } from "./mercado-pago-provider";

afterEach(() => {
  vi.unstubAllGlobals();
  paymentEnv.MERCADO_PAGO_NOTIFICATION_URL = undefined;
  paymentEnv.MERCADO_PAGO_WEBHOOK_SECRET = undefined;
});

it("sends only the card token, issuer and one installment with a scoped webhook URL", async () => {
  paymentEnv.MERCADO_PAGO_NOTIFICATION_URL = "https://example.test/api/webhooks/mercado-pago";
  paymentEnv.MERCADO_PAGO_WEBHOOK_SECRET = "test-signature";
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 123, status: "approved" }) });
  vi.stubGlobal("fetch", fetchMock);
  await new MercadoPagoProvider().createPayment({
    orderNumber: "MS-CARD",
    amountInCents: 12345,
    payerEmail: "buyer@example.test",
    paymentMethodId: "visa",
    paymentToken: "a".repeat(32),
    issuerId: "25",
    installments: 1,
    idempotencyKey: "card-attempt",
    sellerCount: 1,
  });
  const body = JSON.parse(fetchMock.mock.calls[0]?.[1].body as string);
  expect(body).toMatchObject({
    token: "a".repeat(32),
    issuer_id: "25",
    installments: 1,
    transaction_amount: 123.45,
    notification_url: paymentEnv.MERCADO_PAGO_NOTIFICATION_URL,
  });
  expect(body).not.toHaveProperty("card_number");
  expect(body).not.toHaveProperty("security_code");
});

it("rejects a scoped webhook URL without its secret before sending a charge", async () => {
  paymentEnv.MERCADO_PAGO_NOTIFICATION_URL = "https://example.test/api/webhooks/mercado-pago";
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(
    new MercadoPagoProvider().createPayment({
      orderNumber: "MS-CARD",
      amountInCents: 100,
      payerEmail: "buyer@example.test",
      payerTaxId: "19119119100",
      paymentMethodId: "pix",
      idempotencyKey: "attempt",
      sellerCount: 1,
    }),
  ).rejects.toThrow("assinatura");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("discovers by exact reference then fetches the current payment", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ paging: { total: 1 }, results: [{ id: 123 }] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 123, status: "cancelled" }) });
  vi.stubGlobal("fetch", fetchMock);
  expect(await new MercadoPagoProvider().findPaymentByOrderNumber("MS-123")).toMatchObject({
    externalId: "123",
    status: "CANCELLED",
  });
  expect(fetchMock.mock.calls[0]?.[0]).toContain("external_reference=MS-123");
  expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.mercadopago.com/v1/payments/123");
  expect(fetchMock.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
});

it("returns unresolved for an empty search", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ paging: { total: 0 }, results: [] }) }),
  );
  expect(await new MercadoPagoProvider().findPaymentByOrderNumber("MS-123")).toBeNull();
});

it("does not pick an arbitrary payment from an ambiguous search", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ paging: { total: 3 }, results: [{ id: 1 }, { id: 2 }] }) });
  vi.stubGlobal("fetch", fetchMock);
  await expect(new MercadoPagoProvider().findPaymentByOrderNumber("MS-123")).rejects.toThrow("revisão");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("sends the validated payer CPF when creating a Pix payment", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 123, status: "pending" }),
  });
  vi.stubGlobal("fetch", fetchMock);

  await new MercadoPagoProvider().createPayment({
    orderNumber: "MS-TEST-123",
    amountInCents: 10_000,
    payerEmail: "buyer@example.test",
    payerTaxId: "19119119100",
    paymentMethodId: "pix",
    idempotencyKey: "checkout-123",
    sellerCount: 1,
  });

  const request = fetchMock.mock.calls[0]?.[1];
  expect(request).toBeDefined();
  const body = JSON.parse(request?.body as string);
  expect(body).toMatchObject({
    payment_method_id: "pix",
    payer: { email: "buyer@example.test", identification: { type: "CPF", number: "19119119100" } },
  });
  expect(request?.headers["X-Idempotency-Key"]).toBe("checkout-123");
});

it("does not call the gateway when a Pix payment has no CPF", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  await expect(
    new MercadoPagoProvider().createPayment({
      orderNumber: "MS-TEST-123",
      amountInCents: 10_000,
      payerEmail: "buyer@example.test",
      paymentMethodId: "pix",
      idempotencyKey: "checkout-123",
      sellerCount: 1,
    }),
  ).rejects.toThrow("CPF válido");
  expect(fetchMock).not.toHaveBeenCalled();
});
