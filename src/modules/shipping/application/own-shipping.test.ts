import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  methodUpdateMany: vi.fn(),
  methodFindFirst: vi.fn(),
  sellerOrderFindFirst: vi.fn(),
  shipmentUpdate: vi.fn(),
  auditCreate: vi.fn(),
  lock: vi.fn(),
  syncFulfillmentStatuses: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        $queryRaw: mocks.lock,
        sellerShippingMethod: { updateMany: mocks.methodUpdateMany, findFirst: mocks.methodFindFirst },
        sellerOrder: { findFirst: mocks.sellerOrderFindFirst },
        shipment: { update: mocks.shipmentUpdate },
        auditLog: { create: mocks.auditCreate },
      }),
  },
}));
vi.mock("@/modules/orders/application/sync-fulfillment-status", () => ({
  syncFulfillmentStatuses: mocks.syncFulfillmentStatuses,
}));

import { advanceOwnShipment, setOwnShippingMethodActive } from "./own-shipping";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.methodUpdateMany.mockResolvedValue({ count: 0 });
  mocks.methodFindFirst.mockResolvedValue(null);
  mocks.sellerOrderFindFirst.mockResolvedValue(null);
});

describe("own shipping tenant isolation", () => {
  it("does not activate or audit another seller's shipping method", async () => {
    await expect(setOwnShippingMethodActive("seller-b", "user-b", "method-a", true)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(mocks.methodUpdateMany).toHaveBeenCalledWith({
      where: { id: "method-a", sellerId: "seller-b", active: false },
      data: { active: true },
    });
    expect(mocks.methodFindFirst).toHaveBeenCalledWith({
      where: { id: "method-a", sellerId: "seller-b", active: true },
    });
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("does not lock, advance or sync another seller's order", async () => {
    await expect(
      advanceOwnShipment({
        sellerId: "seller-b",
        actorUserId: "user-b",
        sellerOrderId: "seller-order-a",
        status: "SHIPPED",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.sellerOrderFindFirst).toHaveBeenCalledWith({
      where: { id: "seller-order-a", sellerId: "seller-b" },
      select: { orderId: true },
    });
    expect(mocks.lock).not.toHaveBeenCalled();
    expect(mocks.shipmentUpdate).not.toHaveBeenCalled();
    expect(mocks.syncFulfillmentStatuses).not.toHaveBeenCalled();
  });
});
