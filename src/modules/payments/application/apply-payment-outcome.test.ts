import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  release: vi.fn(),
  outbox: vi.fn(),
  warn: vi.fn(),
  tx: {
    payment: { update: vi.fn() },
    paymentTransaction: { update: vi.fn() },
    couponRedemption: { deleteMany: vi.fn() },
    order: { update: vi.fn() },
    sellerOrder: { updateMany: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { warn: mocks.warn, error: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/inventory/application/settle-order-inventory", () => ({
  commitOrderReservations: mocks.commit,
  releaseOrderReservations: mocks.release,
}));
vi.mock("@/modules/outbox/application/record-outbox-event", () => ({ recordOutboxEvent: mocks.outbox }));

import { applyPaymentOutcome, classifyPaymentStatusForPendingOrder } from "./apply-payment-outcome";

const order = { id: "order-1", orderNumber: "MS-1", sellerOrders: [{ sellerId: "s1", items: [] }] };
const tx = mocks.tx as never;
const base = { order, paymentId: "payment-1", transactionId: "tx-1", releaseReason: "Payment declined" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("classifyPaymentStatusForPendingOrder", () => {
  it.each([
    ["APPROVED", "PAID"],
    ["FAILED", "CANCELLED"],
    ["CANCELLED", "CANCELLED"],
    ["REFUNDED", "CANCELLED"],
    ["PENDING", "PENDING_PAYMENT"],
    ["PROCESSING", "PENDING_PAYMENT"],
    ["AUTHORIZED", "PENDING_PAYMENT"],
  ] as const)("%s -> %s", (status, outcome) => {
    expect(classifyPaymentStatusForPendingOrder(status)).toBe(outcome);
  });
});

describe("applyPaymentOutcome", () => {
  it("commits stock, marks the order PAID and records the payment outbox event on approval", async () => {
    const paidAt = new Date("2026-10-07T12:00:00Z");
    const outcome = await applyPaymentOutcome(tx, {
      ...base,
      result: { status: "APPROVED", externalId: "mp-1", providerMetadata: {}, paidAt },
    });
    expect(outcome).toBe("PAID");
    expect(mocks.commit).toHaveBeenCalledWith(tx, order.sellerOrders, "order-1");
    expect(mocks.release).not.toHaveBeenCalled();
    expect(mocks.tx.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUCCEEDED", processedAt: paidAt }) }),
    );
    expect(mocks.tx.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { status: "PAID" } });
    expect(mocks.outbox).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventKey: "order-payment:order-1:APPROVED",
        eventName: "motoshop/order.payment-status.changed",
        payload: { orderNumber: "MS-1", status: "APPROVED", externalId: "mp-1" },
      }),
    );
  });

  it("releases stock, frees the coupon and cancels the order on a decline", async () => {
    const outcome = await applyPaymentOutcome(tx, {
      ...base,
      result: { status: "FAILED", externalId: "mp-1", providerMetadata: {} },
    });
    expect(outcome).toBe("CANCELLED");
    expect(mocks.release).toHaveBeenCalledWith(tx, order.sellerOrders, "order-1", "Payment declined");
    expect(mocks.tx.couponRedemption.deleteMany).toHaveBeenCalledWith({ where: { orderId: "order-1" } });
    expect(mocks.tx.sellerOrder.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
      data: { status: "CANCELLED" },
    });
    expect(mocks.tx.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
    expect(mocks.outbox).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventKey: "order-payment:order-1:FAILED" }),
    );
  });

  it("treats a refund/chargeback of a pending order as terminal and logs it", async () => {
    const outcome = await applyPaymentOutcome(tx, {
      ...base,
      result: { status: "REFUNDED", externalId: "mp-1", providerMetadata: { status: "charged_back" } },
    });
    expect(outcome).toBe("CANCELLED");
    expect(mocks.release).toHaveBeenCalled();
    expect(mocks.tx.couponRedemption.deleteMany).toHaveBeenCalled();
    expect(mocks.tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REFUNDED" }) }),
    );
    expect(mocks.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "payment.refunded_before_settlement" }));
    expect(mocks.outbox).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventKey: "order-payment:order-1:CANCELLED" }),
    );
  });

  it("only mirrors the payment while it is still pending", async () => {
    const outcome = await applyPaymentOutcome(tx, {
      ...base,
      result: { status: "PENDING", externalId: "mp-1", providerMetadata: { status: "pending" } },
    });
    expect(outcome).toBe("PENDING_PAYMENT");
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
    expect(mocks.outbox).not.toHaveBeenCalled();
    expect(mocks.tx.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING", processedAt: null }) }),
    );
  });

  it("does not record an outbox event without a provider payment id", async () => {
    await applyPaymentOutcome(tx, {
      ...base,
      result: { status: "FAILED", providerMetadata: { rejectionHttpStatus: 400 } },
    });
    expect(mocks.tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ externalId: expect.anything() }) }),
    );
    expect(mocks.outbox).not.toHaveBeenCalled();
  });
});
