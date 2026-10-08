import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shipmentFindUnique: vi.fn(),
  txShipmentFindUnique: vi.fn(),
  shipmentUpdate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: { shipment: { findUnique: mocks.shipmentFindUnique }, $transaction: mocks.transaction },
}));

import { confirmShipmentLabelCancelled, markShipmentLabelForCancellation } from "./shipment-label-cancellation";

const tx = {
  $queryRaw: vi.fn(),
  shipment: { findUnique: mocks.txShipmentFindUnique, update: mocks.shipmentUpdate },
  auditLog: { create: mocks.auditCreate },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation((callback) => callback(tx));
});

describe("markShipmentLabelForCancellation", () => {
  it("cancels the shipment and flags a purchased label for provider cancellation with an audit entry", async () => {
    mocks.txShipmentFindUnique.mockResolvedValue({
      id: "shipment-1",
      provider: "MELHOR_ENVIO",
      status: "READY_TO_SHIP",
      externalShipmentId: "external-1",
      providerMetadata: { checkoutResult: "paid" },
    });

    await expect(
      markShipmentLabelForCancellation(tx as never, "seller-order-1", "admin-1"),
    ).resolves.toEqual({ labelCancellationRequired: true });

    expect(mocks.shipmentUpdate).toHaveBeenCalledWith({
      where: { id: "shipment-1" },
      data: {
        status: "CANCELLED",
        purchaseError: expect.stringContaining("Cancele a etiqueta no Melhor Envio"),
        providerMetadata: expect.objectContaining({ checkoutResult: "paid", labelCancellationRequired: true }),
      },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "SHIPMENT_LABEL_CANCELLATION_REQUIRED",
        actorUserId: "admin-1",
        metadata: expect.objectContaining({ externalShipmentId: "external-1", previousStatus: "READY_TO_SHIP" }),
      }),
    });
  });

  it("does nothing when no label was purchased", async () => {
    mocks.txShipmentFindUnique.mockResolvedValue({
      id: "shipment-1",
      provider: "MELHOR_ENVIO",
      status: "PENDING",
      externalShipmentId: null,
      providerMetadata: null,
    });

    await expect(
      markShipmentLabelForCancellation(tx as never, "seller-order-1", "admin-1"),
    ).resolves.toEqual({ labelCancellationRequired: false });
    expect(mocks.shipmentUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("is idempotent for a label already flagged", async () => {
    mocks.txShipmentFindUnique.mockResolvedValue({
      id: "shipment-1",
      provider: "MELHOR_ENVIO",
      status: "CANCELLED",
      externalShipmentId: "external-1",
      providerMetadata: { labelCancellationRequired: true },
    });

    await markShipmentLabelForCancellation(tx as never, "seller-order-1", "admin-1");
    expect(mocks.shipmentUpdate).not.toHaveBeenCalled();
  });
});

describe("confirmShipmentLabelCancelled", () => {
  const flagged = {
    id: "shipment-1",
    provider: "MELHOR_ENVIO",
    externalShipmentId: "external-1",
    providerMetadata: { labelCancellationRequired: true },
    sellerOrder: { order: { orderNumber: "MS-1" } },
  };

  it("clears the pending flag after the admin confirms with the order number", async () => {
    mocks.shipmentFindUnique.mockResolvedValue(flagged);
    mocks.txShipmentFindUnique.mockResolvedValue(flagged);

    await confirmShipmentLabelCancelled({ shipmentId: "shipment-1", actorUserId: "admin-1", confirmedOrderNumber: "MS-1" });

    expect(mocks.shipmentUpdate).toHaveBeenCalledWith({
      where: { id: "shipment-1" },
      data: expect.objectContaining({
        purchaseError: null,
        providerMetadata: expect.objectContaining({ labelCancellationRequired: false }),
      }),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "SHIPMENT_LABEL_CANCELLATION_CONFIRMED", actorUserId: "admin-1" }),
    });
  });

  it("requires the exact order number", async () => {
    mocks.shipmentFindUnique.mockResolvedValue(flagged);

    await expect(
      confirmShipmentLabelCancelled({ shipmentId: "shipment-1", actorUserId: "admin-1", confirmedOrderNumber: "MS-2" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
