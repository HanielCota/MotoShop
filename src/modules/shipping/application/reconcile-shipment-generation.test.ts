import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shipmentFindUnique: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
  auditCreate: vi.fn(),
  getShipmentDetails: vi.fn(),
  getSellerAccessToken: vi.fn(),
  txSellerOrderFindUnique: vi.fn(),
  txShipmentFindUnique: vi.fn(),
  syncFulfillment: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: { shipment: { findUnique: mocks.shipmentFindUnique }, $transaction: mocks.transaction },
}));
vi.mock("@/lib/shipping/melhor-envio-provider", () => ({
  melhorEnvioProvider: { getShipmentDetails: mocks.getShipmentDetails },
}));
vi.mock("@/modules/shipping/infrastructure/melhor-envio-oauth", () => ({
  getSellerMelhorEnvioAccessTokenWithScopes: mocks.getSellerAccessToken,
}));
vi.mock("@/modules/orders/application/sync-fulfillment-status", () => ({
  syncFulfillmentStatuses: mocks.syncFulfillment,
}));

import { reconcileShipmentGeneration } from "./reconcile-shipment-generation";

const shipment = {
  id: "clshipment00000000000001",
  sellerOrderId: "seller-order-1",
  provider: "MELHOR_ENVIO",
  externalShipmentId: "external-shipment-1",
  generationState: "OUTCOME_UNKNOWN",
  updatedAt: new Date("2026-10-02T11:00:00.000Z"),
  sellerOrder: { sellerId: "seller-1", order: { orderNumber: "MS-202610-0001" } },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.shipmentFindUnique.mockResolvedValue(shipment);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  mocks.transaction.mockImplementation((callback) =>
    callback({
      $queryRaw: vi.fn(),
      sellerOrder: { findUnique: mocks.txSellerOrderFindUnique },
      shipment: { updateMany: mocks.updateMany, findUnique: mocks.txShipmentFindUnique },
      auditLog: { create: mocks.auditCreate },
    }),
  );
  mocks.getShipmentDetails.mockResolvedValue({ id: "external-shipment-1" });
  mocks.getSellerAccessToken.mockResolvedValue("seller-sandbox-token");
  lockedSellerOrderStatus("PROCESSING");
  mocks.txShipmentFindUnique.mockResolvedValue({ status: "READY_TO_SHIP", providerMetadata: { result: "ok" } });
});

function lockedSellerOrderStatus(status: string) {
  mocks.txSellerOrderFindUnique.mockReset();
  mocks.txSellerOrderFindUnique.mockResolvedValueOnce({ orderId: "order-1" }).mockResolvedValueOnce({ status });
}

describe("reconcileShipmentGeneration", () => {
  it("verifies the shipment and audits an admin confirmation that generation succeeded", async () => {
    await reconcileShipmentGeneration({
      shipmentId: shipment.id,
      actorUserId: "admin-1",
      confirmedOrderNumber: shipment.sellerOrder.order.orderNumber,
      decision: "CONFIRMED_GENERATED",
    });

    expect(mocks.getSellerAccessToken).toHaveBeenCalledWith("seller-1", ["orders-read"]);
    expect(mocks.getShipmentDetails).toHaveBeenCalledWith("external-shipment-1", "seller-sandbox-token");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: shipment.id, generationState: "OUTCOME_UNKNOWN" }),
      data: expect.objectContaining({
        generationState: "GENERATED",
        generatedAt: expect.any(Date),
        status: "READY_TO_SHIP",
      }),
    });
    expect(mocks.syncFulfillment).toHaveBeenCalledWith(expect.anything(), "seller-order-1", "READY_TO_SHIP", "admin-1");
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "SHIPMENT_GENERATION_RECONCILED",
        actorUserId: "admin-1",
        metadata: expect.objectContaining({ decision: "CONFIRMED_GENERATED" }),
      }),
    });
  });

  it("releases generation only after explicit admin confirmation it did not happen", async () => {
    await reconcileShipmentGeneration({
      shipmentId: shipment.id,
      actorUserId: "admin-1",
      confirmedOrderNumber: shipment.sellerOrder.order.orderNumber,
      decision: "CONFIRMED_NOT_GENERATED",
    });

    expect(mocks.getShipmentDetails).not.toHaveBeenCalled();
    expect(mocks.syncFulfillment).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: shipment.id, generationState: "OUTCOME_UNKNOWN" }),
      data: { generationState: null, generatedAt: null, generationError: null },
    });
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("does not allow reconciliation while a generation request may still be active", async () => {
    mocks.shipmentFindUnique.mockResolvedValue({
      ...shipment,
      generationState: "IN_PROGRESS",
      updatedAt: new Date(),
    });

    await expect(
      reconcileShipmentGeneration({
        shipmentId: shipment.id,
        actorUserId: "admin-1",
        confirmedOrderNumber: shipment.sellerOrder.order.orderNumber,
        decision: "CONFIRMED_NOT_GENERATED",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("records a stale label instead of advancing a cancelled seller order", async () => {
    lockedSellerOrderStatus("CANCELLED");
    await reconcileShipmentGeneration({
      shipmentId: shipment.id,
      actorUserId: "admin-1",
      confirmedOrderNumber: shipment.sellerOrder.order.orderNumber,
      decision: "CONFIRMED_GENERATED",
    });

    expect(mocks.updateMany.mock.calls[0]?.[0]?.data).toMatchObject({
      generationState: "GENERATED",
      generationError: expect.stringContaining("Cancele a etiqueta"),
      status: "CANCELLED",
      providerMetadata: expect.objectContaining({ result: "ok", labelCancellationRequired: true }),
    });
    expect(mocks.syncFulfillment).not.toHaveBeenCalled();
  });

  it("rejects an order number that does not match the shipment", async () => {
    await expect(
      reconcileShipmentGeneration({
        shipmentId: shipment.id,
        actorUserId: "admin-1",
        confirmedOrderNumber: "MS-WRONG",
        decision: "CONFIRMED_NOT_GENERATED",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
