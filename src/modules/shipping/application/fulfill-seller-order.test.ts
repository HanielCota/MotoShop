import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
  shipmentUpdate: vi.fn(),
  txSellerOrderFindUnique: vi.fn(),
  createShipment: vi.fn(),
  send: vi.fn(),
  syncOrderStatus: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: {
    sellerOrder: { findUnique: mocks.findUnique },
    shipment: { updateMany: mocks.updateMany, findUnique: mocks.findUnique },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: mocks.send } }));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.loggerError } }));
vi.mock("@/lib/shipping/melhor-envio-provider", () => ({
  melhorEnvioProvider: { createShipment: mocks.createShipment },
}));
vi.mock("@/modules/orders/application/sync-order-status", () => ({
  syncOrderStatusFromSellerOrders: mocks.syncOrderStatus,
}));

import { purchaseSellerOrderShipment } from "./fulfill-seller-order";

const pendingSellerOrder = {
  id: "seller-order-1",
  status: "PAID",
  shipment: {
    id: "shipment-1",
    provider: "MELHOR_ENVIO",
    externalShipmentId: null,
    purchaseState: null,
    serviceCode: "1",
    carrier: "Transportadora",
    service: "Expresso",
    priceInCents: 2500,
    estimatedDeliveryDays: 3,
  },
  seller: { type: "INDIVIDUAL" },
  store: {
    originName: "Loja",
    originEmail: "loja@example.com",
    originPhone: "11999999999",
    originDocument: "12345678901",
    originPostalCode: "01001000",
    originStreet: "Rua A",
    originNumber: "10",
    originComplement: null,
    originNeighborhood: "Centro",
    originCity: "São Paulo",
    originState: "SP",
    originStateRegister: null,
  },
  order: {
    orderNumber: "MS-1",
    customerName: "Cliente",
    customerEmail: "cliente@example.com",
    customerPhone: "11988887777",
    customerTaxId: null,
    shippingAddress: {
      street: "Rua B",
      number: "20",
      complement: null,
      neighborhood: "Centro",
      city: "São Paulo",
      postalCode: "01001000",
      country: "BR",
      state: "SP",
    },
  },
  items: [
    {
      skuSnapshot: "SKU-1",
      productNameSnapshot: "Capacete",
      unitPriceInCents: 10000,
      quantity: 1,
      weightInGramsSnapshot: 1000,
      heightInMillimetersSnapshot: 100,
      widthInMillimetersSnapshot: 100,
      lengthInMillimetersSnapshot: 100,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue(pendingSellerOrder);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.txSellerOrderFindUnique.mockResolvedValue({ id: "seller-order-1", orderId: "order-1", status: "PAID" });
  mocks.transaction.mockImplementation((callback) =>
    callback({
      shipment: { update: mocks.shipmentUpdate },
      sellerOrder: { findUnique: mocks.txSellerOrderFindUnique, update: vi.fn() },
      $queryRaw: vi.fn(),
      auditLog: { create: vi.fn() },
    }),
  );
  mocks.shipmentUpdate.mockResolvedValue({ ...pendingSellerOrder.shipment, externalShipmentId: "external-1" });
  mocks.createShipment.mockResolvedValue({
    externalShipmentId: "external-1",
    status: "READY_TO_SHIP",
    providerMetadata: {},
  });
  mocks.send.mockResolvedValue({ ids: ["event-1"] });
});

describe("purchaseSellerOrderShipment retry safety", () => {
  it("claims the shipment before the external purchase and clears the claim after success", async () => {
    await purchaseSellerOrderShipment({ sellerOrderId: "seller-order-1", actorUserId: "seller-user-1" });

    expect(mocks.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "shipment-1", externalShipmentId: null, purchaseState: null },
      data: { purchaseState: "IN_PROGRESS", purchaseError: null },
    });
    expect(mocks.createShipment).toHaveBeenCalledOnce();
    expect(mocks.shipmentUpdate).toHaveBeenCalledWith({
      where: { id: "shipment-1" },
      data: expect.objectContaining({ externalShipmentId: "external-1", purchaseState: null, purchaseError: null }),
    });
  });

  it("blocks another external purchase after an uncertain provider result", async () => {
    const timeout = new Error("request timed out");
    mocks.createShipment.mockRejectedValueOnce(timeout);
    await expect(
      purchaseSellerOrderShipment({ sellerOrderId: "seller-order-1", actorUserId: "seller-user-1" }),
    ).rejects.toBe(timeout);

    expect(mocks.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "shipment-1", purchaseState: "IN_PROGRESS", externalShipmentId: null },
      data: {
        purchaseState: "OUTCOME_UNKNOWN",
        purchaseError: "O provedor não confirmou o resultado; confira antes de uma nova tentativa.",
      },
    });

    mocks.findUnique.mockResolvedValue({
      ...pendingSellerOrder,
      shipment: { ...pendingSellerOrder.shipment, purchaseState: "OUTCOME_UNKNOWN" },
    });
    await expect(
      purchaseSellerOrderShipment({ sellerOrderId: "seller-order-1", actorUserId: "seller-user-1" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.createShipment).toHaveBeenCalledOnce();
  });

  it("does not start a second purchase when another request already owns the claim", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    mocks.findUnique.mockResolvedValue({ id: "shipment-1", externalShipmentId: null, purchaseState: "IN_PROGRESS" });

    await expect(
      purchaseSellerOrderShipment({ sellerOrderId: "seller-order-1", actorUserId: "seller-user-1" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.createShipment).not.toHaveBeenCalled();
  });
});
