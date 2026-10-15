import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
  const payment = { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() };
  const sellerOrder = { findFirst: vi.fn() };
  const tx = { $queryRaw: vi.fn(), paymentTransaction: transaction, payment, sellerOrder };
  return { tx, transaction, payment, sellerOrder, refund: vi.fn(), db: { ...tx, $transaction: vi.fn() } };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: mocks.db }));
vi.mock("@/lib/payment/mercado-pago-provider", () => ({ mercadoPagoProvider: { refund: mocks.refund } }));
import { refundPayment } from "./refund-payment";
import { PaymentProviderError } from "@/shared/payment/payment-provider-error";

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
  it("keeps the refund pending when the provider refunded a different amount", async () => {
    mocks.refund.mockResolvedValue({
      externalId: "mp-refund",
      status: "APPROVED",
      providerMetadata: { amount: (input.amountInCents + 100) / 100 },
    });
    await expect(refundPayment(input)).rejects.toThrow("difere do solicitado");
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

describe("resuming a refund whose provider outcome was unknown", () => {
  const pending = {
    id: "refund-tx",
    paymentId: payment.id,
    type: "REFUND",
    status: "PENDING",
    amountInCents: 500,
    payment: { orderId: "order-1", status: "APPROVED", amountInCents: 1000, externalId: "mp-1" },
  };

  it("re-asks the provider with the same idempotency key and settles SUCCEEDED", async () => {
    mocks.transaction.findUnique.mockResolvedValue(pending);
    await expect(refundPayment(input)).resolves.toMatchObject({
      transactionId: "refund-tx",
      paymentStatus: "PARTIALLY_REFUNDED",
    });
    expect(mocks.refund).toHaveBeenCalledWith({ externalId: "mp-1", amountInCents: 500, idempotencyKey: "refund-1" });
    expect(mocks.transaction.create).not.toHaveBeenCalled();
    expect(mocks.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "refund-tx" }, data: expect.objectContaining({ status: "SUCCEEDED" }) }),
    );
    expect(mocks.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: "refund-tx" } }) }),
    );
  });

  it("settles FAILED when the provider reports the refund as rejected", async () => {
    mocks.transaction.findUnique.mockResolvedValue(pending);
    mocks.refund.mockResolvedValue({ externalId: "mp-refund", status: "FAILED", providerMetadata: {} });
    await expect(refundPayment(input)).rejects.toThrow("recusou");
    expect(mocks.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: "refund-tx", status: "PENDING" },
      data: expect.objectContaining({ status: "FAILED" }),
    });
    expect(mocks.payment.update).not.toHaveBeenCalled();
  });

  it("keeps the reservation PENDING while the provider is still processing", async () => {
    mocks.transaction.findUnique.mockResolvedValue(pending);
    mocks.refund.mockResolvedValue({ externalId: "mp-refund", status: "PROCESSING", providerMetadata: {} });
    await expect(refundPayment(input)).rejects.toThrow("não foi confirmado");
    expect(mocks.transaction.update).not.toHaveBeenCalled();
    expect(mocks.transaction.updateMany).not.toHaveBeenCalled();
  });

  it("releases the reservation on a definitive provider rejection, but not on timeouts", async () => {
    mocks.transaction.findUnique.mockResolvedValue(pending);
    mocks.refund.mockRejectedValueOnce(
      new PaymentProviderError("recusado", { httpStatus: 400, outcome: "DEFINITIVE_REJECTION" }),
    );
    await expect(refundPayment(input)).rejects.toThrow("recusado");
    expect(mocks.transaction.updateMany).toHaveBeenCalledTimes(1);

    mocks.transaction.updateMany.mockClear();
    mocks.refund.mockRejectedValueOnce(new PaymentProviderError("timeout", { httpStatus: 504, outcome: "UNKNOWN" }));
    await expect(refundPayment(input)).rejects.toThrow("timeout");
    expect(mocks.transaction.updateMany).not.toHaveBeenCalled();
  });

  it("does not resume a pending refund that belongs to another operation", async () => {
    mocks.transaction.findUnique.mockResolvedValue({ ...pending, amountInCents: 600 });
    await expect(refundPayment(input)).rejects.toThrow("outra operação");
    expect(mocks.refund).not.toHaveBeenCalled();
  });
});

describe("refund ceiling per seller order (L-07)", () => {
  const sellerInput = { ...input, sellerOrderId: "seller-order-a" };

  beforeEach(() => {
    // Seller A charged R$ 6,00 (500 + 100 of shipping) inside a payment of R$ 10,00.
    mocks.sellerOrder.findFirst.mockResolvedValue({
      itemsSubtotalInCents: 600,
      discountAmountInCents: 100,
      customerShippingAmountInCents: 100,
    });
  });

  it("refuses a refund above what was charged from that store even if the payment still has balance", async () => {
    mocks.transaction.findMany.mockResolvedValue([{ amountInCents: 200 }]);

    await expect(refundPayment(sellerInput)).rejects.toThrow("excede o total cobrado desta loja");

    expect(mocks.sellerOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "seller-order-a", orderId: "order-1" } }),
    );
    expect(mocks.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ providerMetadata: { path: ["sellerOrderId"], equals: "seller-order-a" } }),
      }),
    );
    expect(mocks.transaction.create).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("refuses a seller order from another order", async () => {
    mocks.sellerOrder.findFirst.mockResolvedValue(null);

    await expect(refundPayment(sellerInput)).rejects.toThrow("não pertence a este pedido");
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("refunds within the store total and keeps the seller order on the transaction", async () => {
    mocks.transaction.findMany.mockResolvedValue([]);

    await refundPayment(sellerInput);

    expect(mocks.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ providerMetadata: { sellerOrderId: "seller-order-a" } }),
    });
    expect(mocks.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerMetadata: expect.objectContaining({ sellerOrderId: "seller-order-a" }),
        }),
      }),
    );
  });
});
