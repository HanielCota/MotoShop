import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  updateMany: vi.fn(),
  sellerOrderFind: vi.fn(),
  sellerOrderUpdateMany: vi.fn(),
  shipmentFind: vi.fn(),
  audit: vi.fn(),
  refund: vi.fn(),
  syncFulfillment: vi.fn(),
  syncOrder: vi.fn(),
  txFind: vi.fn(),
  txUpdate: vi.fn(),
  sellerOrderUpdate: vi.fn(),
  transactions: vi.fn(),
  payments: vi.fn(),
  cancelInventory: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/payments/application/refund-payment", () => ({ refundPayment: mocks.refund }));
vi.mock("@/modules/inventory/application/settle-order-inventory", () => ({
  cancelCommittedInventory: mocks.cancelInventory,
}));
vi.mock("@/modules/orders/application/sync-fulfillment-status", () => ({
  syncFulfillmentStatuses: mocks.syncFulfillment,
}));
vi.mock("@/modules/orders/application/sync-order-status", () => ({ syncOrderStatusFromSellerOrders: mocks.syncOrder }));
vi.mock("@/modules/shipping/application/shipment-label-cancellation", () => ({
  markShipmentLabelForCancellation: vi.fn().mockResolvedValue({ labelCancellationRequired: false }),
}));
vi.mock("@/lib/database", () => ({
  db: {
    cancellationRequest: { findUnique: mocks.find },
    paymentTransaction: { findMany: mocks.transactions },
    payment: { findMany: mocks.payments },
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        $queryRaw: vi.fn(),
        cancellationRequest: { updateMany: mocks.updateMany, findUnique: mocks.txFind, update: mocks.txUpdate },
        sellerOrder: {
          findUnique: mocks.sellerOrderFind,
          updateMany: mocks.sellerOrderUpdateMany,
          update: mocks.sellerOrderUpdate,
        },
        shipment: { findUnique: mocks.shipmentFind },
        auditLog: { create: mocks.audit },
      }),
  },
}));

import { reviewCancellationRequest } from "./review-cancellation";

const request = {
  id: "request",
  status: "REQUESTED",
  amountInCents: 100,
  orderId: "order-1",
  sellerOrderId: "seller-order-1",
  previousSellerOrderStatus: "PAID",
  sellerOrder: { status: "CANCELLATION_REQUESTED", shipment: null },
  order: { orderNumber: "MS-1" },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.find.mockResolvedValue(request);
  mocks.sellerOrderFind.mockResolvedValue({ status: "CANCELLATION_REQUESTED", shipment: null });
  mocks.transactions.mockResolvedValue([]);
  mocks.payments.mockResolvedValue([{ id: "payment-1", status: "APPROVED" }]);
  mocks.refund.mockResolvedValue({ transactionId: "refund-tx", paymentStatus: "PARTIALLY_REFUNDED" });
  mocks.txFind.mockResolvedValue({
    id: "request",
    status: "APPROVED",
    amountInCents: 100,
    orderId: "order-1",
    sellerId: "seller-1",
    sellerOrderId: "seller-order-1",
    sellerOrder: { items: [] },
  });
});

describe("approve cancellation", () => {
  it("does not refund a cancellation decided by another administrator in the meantime", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      reviewCancellationRequest({ cancellationRequestId: "request", decision: "APPROVE", actorUserId: "admin" }),
    ).rejects.toThrow("já foi decidida");
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("re-reads the shipment inside the transaction and blocks a package posted meanwhile", async () => {
    mocks.sellerOrderFind.mockResolvedValue({ status: "CANCELLATION_REQUESTED", shipment: { status: "IN_TRANSIT" } });
    await expect(
      reviewCancellationRequest({ cancellationRequestId: "request", decision: "APPROVE", actorUserId: "admin" }),
    ).rejects.toThrow("devolução");
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
  });
});

describe("retry of an approved cancellation whose refund failed", () => {
  beforeEach(() => {
    mocks.find.mockResolvedValue({ ...request, status: "APPROVED" });
  });

  it("derives a new attempt key when the previous refund was definitively rejected", async () => {
    mocks.transactions.mockResolvedValue([{ idempotencyKey: "cancellation-refund:request", status: "FAILED" }]);
    await expect(
      reviewCancellationRequest({ cancellationRequestId: "request", decision: "APPROVE", actorUserId: "admin" }),
    ).resolves.toEqual({ outcome: "REFUNDED", orderNumber: "MS-1" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.refund).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "cancellation-refund:request:retry-1", amountInCents: 100 }),
    );
    expect(mocks.cancelInventory).toHaveBeenCalledOnce();
    expect(mocks.sellerOrderUpdate).toHaveBeenCalledWith({
      where: { id: "seller-order-1" },
      data: { status: "CANCELLED" },
    });
    expect(mocks.txUpdate).toHaveBeenCalledWith({ where: { id: "request" }, data: { status: "REFUNDED" } });
    expect(mocks.audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CANCELLATION_REFUNDED",
        metadata: expect.objectContaining({
          refundAttempt: 2,
          refundIdempotencyKey: "cancellation-refund:request:retry-1",
        }),
      }),
    });
  });

  it("reuses the pending attempt instead of starting another refund", async () => {
    mocks.transactions.mockResolvedValue([{ idempotencyKey: "cancellation-refund:request", status: "PENDING" }]);
    mocks.refund.mockRejectedValue(new Error("O reembolso ainda não foi confirmado pelo provedor."));
    await expect(
      reviewCancellationRequest({ cancellationRequestId: "request", decision: "APPROVE", actorUserId: "admin" }),
    ).rejects.toThrow("ainda não foi confirmado");
    expect(mocks.refund).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "cancellation-refund:request" }),
    );
    expect(mocks.txUpdate).not.toHaveBeenCalled();
  });

  it("closes the request when the payment was already fully refunded upstream", async () => {
    mocks.transactions.mockResolvedValue([{ idempotencyKey: "cancellation-refund:request", status: "FAILED" }]);
    mocks.payments.mockResolvedValue([{ id: "payment-1", status: "REFUNDED" }]);
    await expect(
      reviewCancellationRequest({ cancellationRequestId: "request", decision: "APPROVE", actorUserId: "admin" }),
    ).resolves.toEqual({ outcome: "REFUNDED", orderNumber: "MS-1" });
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.cancelInventory).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: { amountInCents: 100, upstreamRefund: true, paymentId: "payment-1" },
      }),
    });
  });
});

describe("reject cancellation", () => {
  beforeEach(() => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.sellerOrderUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("restores the previous status and re-syncs it from the current shipment", async () => {
    mocks.shipmentFind.mockResolvedValue({ status: "IN_TRANSIT" });
    await expect(
      reviewCancellationRequest({ cancellationRequestId: "request", decision: "REJECT", actorUserId: "admin" }),
    ).resolves.toEqual({ outcome: "REJECTED", orderNumber: "MS-1" });
    expect(mocks.sellerOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: "seller-order-1", status: "CANCELLATION_REQUESTED" },
      data: { status: "PAID" },
    });
    expect(mocks.syncFulfillment).toHaveBeenCalledWith(expect.anything(), "seller-order-1", "IN_TRANSIT", "admin");
    expect(mocks.syncOrder).not.toHaveBeenCalled();
  });

  it("only re-syncs the order status when there is no shipment yet", async () => {
    mocks.shipmentFind.mockResolvedValue(null);
    await reviewCancellationRequest({ cancellationRequestId: "request", decision: "REJECT", actorUserId: "admin" });
    expect(mocks.syncFulfillment).not.toHaveBeenCalled();
    expect(mocks.syncOrder).toHaveBeenCalledWith(expect.anything(), "order-1", "CANCELLATION", "admin");
  });
});
