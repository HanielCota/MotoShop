import { expect, it, vi } from "vitest";
import type { OrderStatusTransaction } from "./sync-order-status";

import { syncOrderStatusFromSellerOrders } from "./sync-order-status";

vi.mock("server-only", () => ({}));

function transaction(input: {
  orderStatus: "PAID" | "PROCESSING";
  sellerOrderStatuses: Array<"PAID" | "PROCESSING" | "CANCELLATION_REQUESTED" | "CANCELLED">;
}) {
  return {
    $queryRaw: vi.fn(async () => []),
    order: {
      findUnique: vi.fn(async () => ({ id: "order-1", status: input.orderStatus })),
      update: vi.fn(async () => undefined),
    },
    sellerOrder: {
      findMany: vi.fn(async () => input.sellerOrderStatuses.map((status) => ({ status }))),
    },
    auditLog: { create: vi.fn(async () => undefined) },
  } as unknown as OrderStatusTransaction;
}

it("moves the aggregate order into processing while a seller cancellation is pending", async () => {
  const tx = transaction({ orderStatus: "PAID", sellerOrderStatuses: ["CANCELLATION_REQUESTED", "PAID"] });

  await expect(syncOrderStatusFromSellerOrders(tx, "order-1", "CANCELLATION")).resolves.toBe("PROCESSING");
  expect(tx.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { status: "PROCESSING" } });
  expect(tx.auditLog.create).not.toHaveBeenCalled();
});

it("restores the aggregate status after cancellation rejection and audits an authenticated change", async () => {
  const tx = transaction({ orderStatus: "PROCESSING", sellerOrderStatuses: ["PAID", "PAID"] });

  await expect(syncOrderStatusFromSellerOrders(tx, "order-1", "CANCELLATION", "admin-1")).resolves.toBe("PAID");
  expect(tx.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { status: "PAID" } });
  expect(tx.auditLog.create).toHaveBeenCalledWith({
    data: {
      action: "ORDER_STATUS_CHANGED",
      entityType: "ORDER",
      entityId: "order-1",
      actorUserId: "admin-1",
      metadata: { previousStatus: "PROCESSING", nextStatus: "PAID", source: "CANCELLATION" },
    },
  });
});

it("does not write or audit when the aggregate order status is already correct", async () => {
  const tx = transaction({ orderStatus: "PAID", sellerOrderStatuses: ["PAID", "PAID"] });

  await expect(syncOrderStatusFromSellerOrders(tx, "order-1", "FULFILLMENT", "seller-1")).resolves.toBe("PAID");
  expect(tx.order.update).not.toHaveBeenCalled();
  expect(tx.auditLog.create).not.toHaveBeenCalled();
});
