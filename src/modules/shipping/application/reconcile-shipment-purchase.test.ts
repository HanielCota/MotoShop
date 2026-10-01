import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shipmentFindUnique: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
  auditCreate: vi.fn(),
  getShipmentDetails: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: { shipment: { findUnique: mocks.shipmentFindUnique }, $transaction: mocks.transaction },
}));
vi.mock("@/lib/shipping/melhor-envio-provider", () => ({
  melhorEnvioProvider: { getShipmentDetails: mocks.getShipmentDetails },
}));

import { reconcileShipmentPurchase } from "./reconcile-shipment-purchase";

const shipment = {
  id: "clshipment00000000000001",
  provider: "MELHOR_ENVIO",
  purchaseState: "OUTCOME_UNKNOWN",
  externalShipmentId: null,
  sellerOrder: { orderId: "clorder0000000000000001", order: { orderNumber: "MS-202610-0001" } },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.shipmentFindUnique.mockResolvedValue(shipment);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  mocks.transaction.mockImplementation((callback) =>
    callback({ shipment: { updateMany: mocks.updateMany }, auditLog: { create: mocks.auditCreate } }),
  );
  mocks.getShipmentDetails.mockResolvedValue({
    id: "external-shipment-1",
    options: { tags: [{ tag: "MS-202610-0001" }] },
  });
});

describe("reconcileShipmentPurchase", () => {
  it("associates a verified provider shipment and audits the admin decision atomically", async () => {
    await reconcileShipmentPurchase({
      shipmentId: shipment.id,
      actorUserId: "admin-1",
      confirmedOrderNumber: "MS-202610-0001",
      decision: "CONFIRMED_PURCHASE",
      externalShipmentId: "external-shipment-1",
    });

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: shipment.id,
        provider: "MELHOR_ENVIO",
        externalShipmentId: null,
        purchaseState: { in: ["IN_PROGRESS", "OUTCOME_UNKNOWN"] },
      },
      data: expect.objectContaining({
        externalShipmentId: "external-shipment-1",
        purchaseState: null,
        status: "READY_TO_SHIP",
      }),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "SHIPMENT_PURCHASE_RECONCILED",
        actorUserId: "admin-1",
        metadata: expect.objectContaining({ providerTagMatched: true }),
      }),
    });
  });

  it("does not associate a shipment carrying another order's platform tag", async () => {
    mocks.getShipmentDetails.mockResolvedValue({ id: "external-shipment-1", options: { tags: [{ tag: "MS-OTHER" }] } });

    await expect(
      reconcileShipmentPurchase({
        shipmentId: shipment.id,
        actorUserId: "admin-1",
        confirmedOrderNumber: "MS-202610-0001",
        decision: "CONFIRMED_PURCHASE",
        externalShipmentId: "external-shipment-1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires the exact order number as an explicit human confirmation", async () => {
    await expect(
      reconcileShipmentPurchase({
        shipmentId: shipment.id,
        actorUserId: "admin-1",
        confirmedOrderNumber: "MS-WRONG",
        decision: "CONFIRMED_NOT_PURCHASED",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("releases a retry only after the admin confirms no provider purchase and records it", async () => {
    await reconcileShipmentPurchase({
      shipmentId: shipment.id,
      actorUserId: "admin-1",
      confirmedOrderNumber: "MS-202610-0001",
      decision: "CONFIRMED_NOT_PURCHASED",
    });

    expect(mocks.getShipmentDetails).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: shipment.id,
        provider: "MELHOR_ENVIO",
        externalShipmentId: null,
        purchaseState: { in: ["IN_PROGRESS", "OUTCOME_UNKNOWN"] },
      },
      data: { purchaseState: null, purchaseError: null },
    });
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("does not claim a shipment that has already been resolved", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      reconcileShipmentPurchase({
        shipmentId: shipment.id,
        actorUserId: "admin-1",
        confirmedOrderNumber: "MS-202610-0001",
        decision: "CONFIRMED_NOT_PURCHASED",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
