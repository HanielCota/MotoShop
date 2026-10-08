import { afterEach, expect, it, vi } from "vitest";
const paymentEnv = vi.hoisted(() => ({
  LOG_LEVEL: "silent",
  NODE_ENV: "test",
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

class ConnectedSellerTestProvider extends MercadoPagoProvider {
  override supportsSellerCount(sellerCount: number): boolean {
    return sellerCount === 1;
  }
}

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
  await new ConnectedSellerTestProvider().createPayment({
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

it("keeps only payment-matching fields and Pix instructions from provider responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 123,
        status: "pending",
        status_detail: "pending_waiting_transfer",
        external_reference: "MS-PRIVACY",
        transaction_amount: 123.45,
        currency_id: "BRL",
        payment_method_id: "pix",
        payer: { email: "buyer@example.test", identification: { type: "CPF", number: "19119119100" } },
        card: { last_four_digits: "1234" },
        point_of_interaction: {
          transaction_data: {
            qr_code: "pix-copy-code",
            qr_code_base64: "cGl4LWltYWdl",
            payer: { email: "buyer@example.test" },
          },
        },
      }),
    }),
  );

  const result = await new ConnectedSellerTestProvider().createPayment({
    orderNumber: "MS-PRIVACY",
    amountInCents: 12_345,
    payerEmail: "buyer@example.test",
    payerTaxId: "19119119100",
    paymentMethodId: "pix",
    idempotencyKey: "privacy-test",
    sellerCount: 1,
  });

  expect(result.providerMetadata).toEqual({
    external_reference: "MS-PRIVACY",
    currency_id: "BRL",
    payment_method_id: "pix",
    status: "pending",
    status_detail: "pending_waiting_transfer",
    transaction_amount: 123.45,
    point_of_interaction: { transaction_data: { qr_code: "pix-copy-code", qr_code_base64: "cGl4LWltYWdl" } },
  });
  expect(JSON.stringify(result.providerMetadata)).not.toContain("19119119100");
  expect(JSON.stringify(result.providerMetadata)).not.toContain("buyer@example.test");
});

it("rejects a scoped webhook URL without its secret before sending a charge", async () => {
  paymentEnv.MERCADO_PAGO_NOTIFICATION_URL = "https://example.test/api/webhooks/mercado-pago";
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(
    new ConnectedSellerTestProvider().createPayment({
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

it("classifies validation failures as definitive and transient failures as uncertain", async () => {
  const provider = new ConnectedSellerTestProvider();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: "bad_request" }) })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: "temporary_failure" }) }),
  );
  const input = {
    orderNumber: "MS-REJECTION",
    amountInCents: 100,
    payerEmail: "buyer@example.test",
    payerTaxId: "19119119100",
    paymentMethodId: "pix",
    idempotencyKey: "attempt",
    sellerCount: 1,
  } as const;

  await expect(provider.createPayment(input)).rejects.toMatchObject({
    name: "PaymentProviderError",
    details: { httpStatus: 400, outcome: "DEFINITIVE_REJECTION", providerCode: "bad_request" },
  });
  await expect(provider.createPayment({ ...input, idempotencyKey: "attempt-2" })).rejects.toMatchObject({
    name: "PaymentProviderError",
    details: { httpStatus: 503, outcome: "UNKNOWN" },
  });
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

  await new ConnectedSellerTestProvider().createPayment({
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
    new ConnectedSellerTestProvider().createPayment({
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

it("blocks marketplace charges until seller-linked Mercado Pago OAuth is available", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const provider = new MercadoPagoProvider();

  expect(provider.supportsSellerCount(1)).toBe(false);
  await expect(
    provider.createPayment({
      orderNumber: "MS-NO-SELLER-AUTH",
      amountInCents: 100,
      payerEmail: "buyer@example.test",
      paymentMethodId: "pix",
      payerTaxId: "19119119100",
      idempotencyKey: "blocked-payment",
      sellerCount: 1,
    }),
  ).rejects.toThrow("Nenhuma cobrança foi criada");
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([
  { providerStatus: "charged_back", expected: "REFUNDED" },
  { providerStatus: "in_mediation", expected: "PROCESSING" },
])("maps $providerStatus without inventing payment statuses", async ({ providerStatus, expected }) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 456, status: providerStatus }) }),
  );
  expect(await new MercadoPagoProvider().getPayment("456")).toMatchObject({ externalId: "456", status: expected });
});

it("treats a rate-limited (429) charge request as definitively not processed", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: "too_many_requests" }) }),
  );
  await expect(
    new ConnectedSellerTestProvider().createPayment({
      orderNumber: "MS-RATE",
      amountInCents: 100,
      payerEmail: "buyer@example.test",
      payerTaxId: "19119119100",
      paymentMethodId: "pix",
      idempotencyKey: "rate-attempt",
      sellerCount: 1,
    }),
  ).rejects.toMatchObject({ details: { httpStatus: 429, outcome: "DEFINITIVE_REJECTION" } });
});

it("maps the refund resource with its own id, amount and status", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      id: 999,
      payment_id: 456,
      amount: 12.5,
      status: "approved",
      payer: { email: "x@example.test" },
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  const result = await new MercadoPagoProvider().refund({
    externalId: "456",
    amountInCents: 1_250,
    idempotencyKey: "refund-1",
  });
  expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body as string)).toEqual({ amount: 12.5 });
  expect(result).toMatchObject({
    externalId: "999",
    status: "APPROVED",
    providerMetadata: { refund_id: "999", payment_id: "456", amount: 12.5, status: "approved" },
  });
  expect(JSON.stringify(result.providerMetadata)).not.toContain("example.test");
});

it.each([
  { refundStatus: "rejected", expected: "FAILED" },
  { refundStatus: "cancelled", expected: "CANCELLED" },
  { refundStatus: "in_process", expected: "PROCESSING" },
])("maps refund status $refundStatus", async ({ refundStatus, expected }) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, status: refundStatus }) }));
  expect(await new MercadoPagoProvider().refund({ externalId: "456", idempotencyKey: "r" })).toMatchObject({
    status: expected,
  });
});

it("keeps the refunded amount reported on the payment for reconciliation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 7, status: "refunded", transaction_amount: 10, transaction_amount_refunded: 10 }),
    }),
  );
  expect((await new MercadoPagoProvider().getPayment("7")).providerMetadata).toMatchObject({
    transaction_amount_refunded: 10,
  });
});
