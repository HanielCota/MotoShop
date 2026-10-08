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

import { reconcileShipmentPurchase } from "./reconcile-shipment-purchase";

const shipment = {
  id: "clshipment00000000000001",
  sellerOrderId: "seller-order-1",
  provider: "MELHOR_ENVIO",
  purchaseState: "OUTCOME_UNKNOWN",
  externalShipmentId: null,
  sellerOrder: {
    sellerId: "seller-1",
    orderId: "clorder0000000000000001",
    order: { orderNumber: "MS-202610-0001" },
  },
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
  mocks.getShipmentDetails.mockResolvedValue({
    id: "external-shipment-1",
    options: { tags: [{ tag: "MS-202610-0001" }] },
  });
  mocks.getSellerAccessToken.mockResolvedValue("seller-sandbox-token");
  lockedSellerOrderStatus("PROCESSING");
  mocks.txShipmentFindUnique.mockResolvedValue({ status: "READY_TO_SHIP", providerMetadata: { result: "ok" } });
});

function lockedSellerOrderStatus(status: string) {
  mocks.txSellerOrderFindUnique.mockReset();
  mocks.txSellerOrderFindUnique.mockResolvedValueOnce({ orderId: "order-1" }).mockResolvedValueOnce({ status });
}

describe("reconcileShipmentPurchase", () => {
  it("associates a verified provider shipment and audits the admin decision atomically", async () => {
    mocks.getShipmentDetails.mockResolvedValue({
      id: "external-shipment-1",
      options: { tags: [{ tag: "MS-202610-0001" }] },
      receiver: { document: "12345678900", address: "Rua confidencial" },
    });
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
        purchaseState: "OUTCOME_UNKNOWN",
      },
      data: expect.objectContaining({
        externalShipmentId: "external-shipment-1",
        purchaseState: null,
        status: "READY_TO_SHIP",
      }),
    });
    expect(mocks.getShipmentDetails).toHaveBeenCalledWith("external-shipment-1", "seller-sandbox-token");
    expect(mocks.getSellerAccessToken).toHaveBeenCalledWith("seller-1", ["orders-read"]);
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "SHIPMENT_PURCHASE_RECONCILED",
        actorUserId: "admin-1",
        metadata: expect.objectContaining({ providerTagMatched: true }),
      }),
    });
    expect(mocks.updateMany.mock.calls[0]?.[0]?.data.providerMetadata).toEqual({
      reconciled: true,
      providerTagMatched: true,
    });
    expect(JSON.stringify(mocks.updateMany.mock.calls[0]?.[0]?.data.providerMetadata)).not.toContain("12345678900");
    expect(mocks.syncFulfillment).toHaveBeenCalledWith(expect.anything(), "seller-order-1", "READY_TO_SHIP", "admin-1");
  });

  it("does not mark a shipment ready when the seller order was cancelled before reconciliation", async () => {
    lockedSellerOrderStatus("CANCELLED");
    await reconcileShipmentPurchase({
      shipmentId: shipment.id,
      actorUserId: "admin-1",
      confirmedOrderNumber: "MS-202610-0001",
      decision: "CONFIRMED_PURCHASE",
      externalShipmentId: "external-shipment-1",
    });

    const data = mocks.updateMany.mock.calls[0]?.[0]?.data;
    expect(data).toMatchObject({
      externalShipmentId: "external-shipment-1",
      purchaseState: null,
      status: "CANCELLED",
      purchaseError: expect.stringContaining("Cancele a etiqueta"),
      providerMetadata: expect.objectContaining({ labelCancellationRequired: true }),
    });
    expect(mocks.syncFulfillment).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ staleSellerOrderStatus: "CANCELLED" }),
      }),
    });
  });

  it("keeps the status untouched while a cancellation request is under review", async () => {
    lockedSellerOrderStatus("CANCELLATION_REQUESTED");
    await reconcileShipmentPurchase({
      shipmentId: shipment.id,
      actorUserId: "admin-1",
      confirmedOrderNumber: "MS-202610-0001",
      decision: "CONFIRMED_PURCHASE",
      externalShipmentId: "external-shipment-1",
    });

    const data = mocks.updateMany.mock.calls[0]?.[0]?.data;
    expect(data).not.toHaveProperty("status");
    expect(data.purchaseError).toContain("Cancele a etiqueta");
    expect(mocks.syncFulfillment).not.toHaveBeenCalled();
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
        purchaseState: "OUTCOME_UNKNOWN",
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

  it("does not release an active purchase claim before the provider timeout window", async () => {
    mocks.shipmentFindUnique.mockResolvedValue({ ...shipment, purchaseState: "IN_PROGRESS", updatedAt: new Date() });

    await expect(
      reconcileShipmentPurchase({
        shipmentId: shipment.id,
        actorUserId: "admin-1",
        confirmedOrderNumber: "MS-202610-0001",
        decision: "CONFIRMED_NOT_PURCHASED",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
