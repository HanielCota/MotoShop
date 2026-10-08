import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    payment: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    webhookEvent: { update: vi.fn() },
  };
  return {
    tx,
    applyOutcome: vi.fn(),
    db: { payment: { findFirst: vi.fn() }, webhookEvent: { update: vi.fn() }, $transaction: vi.fn() },
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: mocks.db }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
import { logger } from "@/lib/logger";
vi.mock("./apply-payment-outcome", () => ({ applyPaymentOutcome: mocks.applyOutcome }));

import { reconcileMercadoPagoPayment } from "./reconcile-payment";

const order = { id: "order-1", orderNumber: "MS-1", status: "PENDING_PAYMENT", sellerOrders: [] };
const storedPayment = {
  id: "payment-1",
  externalId: null,
  amountInCents: 1000,
  currency: "BRL",
  method: "pix",
  status: "PENDING",
  order,
  transactions: [{ id: "auth-tx", type: "AUTHORIZATION" }],
};
const result = (status: "REFUNDED" | "PARTIALLY_REFUNDED" | "FAILED") => ({
  externalId: "mp-1",
  status,
  providerMetadata: {
    external_reference: "MS-1",
    currency_id: "BRL",
    transaction_amount: 10,
    payment_method_id: "pix",
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.payment.findFirst.mockResolvedValue(storedPayment);
  mocks.db.$transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.tx.payment.findUniqueOrThrow.mockResolvedValue(storedPayment);
  mocks.applyOutcome.mockResolvedValue("CANCELLED");
});

it("settles a pending order whose payment was refunded or charged back as terminal", async () => {
  await expect(
    reconcileMercadoPagoPayment({ externalId: "mp-1", result: result("REFUNDED"), webhookEventId: "event-1" }),
  ).resolves.toEqual({ orderNumber: "MS-1", status: "REFUNDED" });
  expect(mocks.applyOutcome).toHaveBeenCalledWith(
    mocks.tx,
    expect.objectContaining({
      order,
      paymentId: "payment-1",
      transactionId: "auth-tx",
      result: expect.objectContaining({ status: "REFUNDED", externalId: "mp-1" }),
      releaseReason: "Payment refunded or charged back",
    }),
  );
  expect(mocks.tx.webhookEvent.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSED" }) }),
  );
});

it("routes a partial refund of a pending order to manual review without touching the order", async () => {
  await reconcileMercadoPagoPayment({
    externalId: "mp-1",
    result: result("PARTIALLY_REFUNDED"),
    webhookEventId: "event-1",
  });
  expect(mocks.applyOutcome).not.toHaveBeenCalled();
  expect(mocks.tx.webhookEvent.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
  );
});

it("does not re-settle an order that already left PENDING_PAYMENT", async () => {
  mocks.tx.payment.findUniqueOrThrow.mockResolvedValue({
    ...storedPayment,
    status: "FAILED",
    order: { ...order, status: "CANCELLED" },
  });
  await reconcileMercadoPagoPayment({ externalId: "mp-1", result: result("FAILED") });
  expect(mocks.applyOutcome).not.toHaveBeenCalled();
});

const paidPayment = (transactions: Array<{ id: string; type: string; status: string; amountInCents: number }>) => ({
  ...storedPayment,
  externalId: "mp-1",
  status: "APPROVED",
  order: { ...order, status: "PAID" },
  transactions: [{ id: "auth-tx", type: "AUTHORIZATION", status: "SUCCEEDED", amountInCents: 1000 }, ...transactions],
});

it.each([
  { label: "chargeback", status: "REFUNDED" as const, raw: "charged_back", text: "chargeback" },
  { label: "mediation", status: "PROCESSING" as const, raw: "in_mediation", text: "mediação" },
  { label: "out-of-band refund", status: "REFUNDED" as const, raw: "refunded", text: "não corresponde" },
])("flags an unexplained $label on a paid order for review without mirroring it", async ({ status, raw, text }) => {
  mocks.tx.payment.findUniqueOrThrow.mockResolvedValue(paidPayment([]));
  const base = result("REFUNDED");
  await expect(
    reconcileMercadoPagoPayment({
      externalId: "mp-1",
      result: { ...base, status, providerMetadata: { ...base.providerMetadata, status: raw } } as never,
      webhookEventId: "event-1",
    }),
  ).resolves.toEqual({ orderNumber: "MS-1", status: "APPROVED" });
  expect(mocks.tx.payment.update).not.toHaveBeenCalled();
  expect(mocks.tx.webhookEvent.update).toHaveBeenCalledWith({
    where: { id: "event-1" },
    data: { status: "FAILED", processedAt: null, error: expect.stringContaining(text) },
  });
  expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "payment.unexplained_reversal" }));
});

it("mirrors a refund explained by an internal refund transaction", async () => {
  mocks.tx.payment.findUniqueOrThrow.mockResolvedValue(
    paidPayment([{ id: "refund-tx", type: "REFUND", status: "PENDING", amountInCents: 1000 }]),
  );
  await reconcileMercadoPagoPayment({ externalId: "mp-1", result: result("REFUNDED"), webhookEventId: "event-1" });
  expect(mocks.tx.payment.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ status: "REFUNDED" }) }),
  );
  expect(mocks.tx.webhookEvent.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSED" }) }),
  );
});

it.each([{ ref: "ORDER-42" }, { ref: undefined }])(
  "acknowledges a webhook for a payment from another integration ($ref)",
  async ({ ref }) => {
    mocks.db.payment.findFirst.mockResolvedValue(null);
    const base = result("FAILED");
    const withoutReference: Record<string, unknown> = { ...base.providerMetadata };
    delete withoutReference.external_reference;
    await reconcileMercadoPagoPayment({
      externalId: "mp-foreign",
      result: {
        ...base,
        externalId: "mp-foreign",
        providerMetadata: ref ? { ...withoutReference, external_reference: ref } : withoutReference,
      },
      webhookEventId: "event-1",
    });
    expect(mocks.db.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "event-1" }, data: expect.objectContaining({ status: "PROCESSED" }) }),
    );
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "payment.webhook.foreign_reference_ignored" }),
    );
  },
);

it("still reports NOT_FOUND for a Moto Shop reference not yet persisted", async () => {
  mocks.db.payment.findFirst.mockResolvedValue(null);
  await expect(
    reconcileMercadoPagoPayment({ externalId: "mp-1", result: result("FAILED"), webhookEventId: "event-1" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(mocks.db.webhookEvent.update).not.toHaveBeenCalled();
});
