import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() };
  const payment = { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() };
  const tx = { $queryRaw: vi.fn(), paymentTransaction: transaction, payment };
  return { tx, transaction, payment, refund: vi.fn(), db: { ...tx, $transaction: vi.fn() } };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: mocks.db }));
vi.mock("@/lib/payment/mercado-pago-provider", () => ({ mercadoPagoProvider: { refund: mocks.refund } }));
import { refundPayment } from "./refund-payment";

const input = { orderId: "order-1", amountInCents: 500, idempotencyKey: "refund-1" };
const payment = {
  id: "payment-1",
  externalId: "mp-1",
  orderId: "order-1",
  amountInCents: 1000,
  status: "APPROVED",
  transactions: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.$transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.transaction.findUnique.mockResolvedValue(null);
  mocks.transaction.findMany.mockResolvedValue([]);
  mocks.payment.findFirst.mockResolvedValue(payment);
  mocks.payment.findUnique.mockResolvedValue(payment);
  mocks.transaction.create.mockResolvedValue({ id: "refund-tx" });
  mocks.refund.mockResolvedValue({ externalId: "mp-refund", status: "APPROVED", providerMetadata: {} });
});

describe("refund reservation and idempotency", () => {
  it("keeps the reservation pending on a network exception", async () => {
    mocks.refund.mockRejectedValue(new Error("timeout after provider acceptance"));
    await expect(refundPayment(input)).rejects.toThrow("timeout");
    expect(mocks.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING" }) }),
    );
    expect(mocks.transaction.update).not.toHaveBeenCalled();
    expect(mocks.payment.update).not.toHaveBeenCalled();
  });
  it("does not release a reservation if local finalization fails", async () => {
    mocks.transaction.update.mockRejectedValue(new Error("database unavailable"));
    await expect(refundPayment(input)).rejects.toThrow("database unavailable");
    expect(mocks.transaction.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });
  it("blocks another refund while an earlier outcome is unknown", async () => {
    mocks.payment.findUnique.mockResolvedValue({
      ...payment,
      transactions: [{ type: "REFUND", status: "PENDING", amountInCents: 100 }],
    });
    await expect(refundPayment(input)).rejects.toThrow("pendente");
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it.each([
    { type: "AUTHORIZATION", payment: { orderId: "order-1", status: "APPROVED" }, amountInCents: 500 },
    { type: "REFUND", payment: { orderId: "other-order", status: "REFUNDED" }, amountInCents: 500 },
    { type: "REFUND", payment: { orderId: "order-1", status: "REFUNDED" }, amountInCents: 600 },
  ])("rejects reuse of an idempotency key for a different operation", async (existing) => {
    mocks.transaction.findUnique.mockResolvedValue({ id: "existing", status: "SUCCEEDED", ...existing });
    await expect(refundPayment(input)).rejects.toThrow("outra operação");
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("rejects zero-value refunds before reading the database", async () => {
    await expect(refundPayment({ ...input, amountInCents: 0 })).rejects.toThrow("positivo");
    expect(mocks.transaction.findUnique).not.toHaveBeenCalled();
  });
  it("does not treat an unconfirmed provider result as success", async () => {
    mocks.refund.mockResolvedValue({ status: "PENDING" });
    await expect(refundPayment(input)).rejects.toThrow("não foi confirmado");
    expect(mocks.transaction.update).not.toHaveBeenCalled();
  });
  it("calculates full refund status from settled transactions", async () => {
    const prior = { type: "REFUND", status: "SUCCEEDED", amountInCents: 500 };
    mocks.payment.findUnique.mockResolvedValue({ ...payment, transactions: [prior] });
    mocks.transaction.findMany.mockResolvedValue([prior]);
    await expect(refundPayment(input)).resolves.toMatchObject({ paymentStatus: "REFUNDED" });
    expect(mocks.payment.update).toHaveBeenCalledWith({ where: { id: payment.id }, data: { status: "REFUNDED" } });
  });
  it("rejects amounts above the remaining balance", async () => {
    mocks.payment.findUnique.mockResolvedValue({
      ...payment,
      transactions: [{ type: "REFUND", status: "SUCCEEDED", amountInCents: 501 }],
    });
    await expect(refundPayment(input)).rejects.toThrow("excede");
    expect(mocks.refund).not.toHaveBeenCalled();
  });
});
