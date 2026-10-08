import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
  shipmentUpdate: vi.fn(),
  txSellerOrderFindUnique: vi.fn(),
  outboxUpsert: vi.fn(),
  addToCart: vi.fn(),
  checkoutCart: vi.fn(),
  quote: vi.fn(),
  generateShipment: vi.fn(),
  track: vi.fn(),
  txShipmentFindUnique: vi.fn(),
  txSellerOrderUpdate: vi.fn(),
  send: vi.fn(),
  syncOrderStatus: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  auditCreate: vi.fn(),
  txShipmentUpdate: vi.fn(),
  getSellerAccessToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: {
    sellerOrder: { findFirst: mocks.findUnique },
    shipment: { updateMany: mocks.updateMany, findUnique: mocks.findUnique },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: mocks.send } }));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.loggerError, warn: mocks.loggerWarn } }));
vi.mock("@/lib/shipping/melhor-envio-provider", () => ({
  melhorEnvioProvider: {
    addToCart: mocks.addToCart,
    checkoutCart: mocks.checkoutCart,
    quote: mocks.quote,
    generateShipment: mocks.generateShipment,
    track: mocks.track,
  },
}));
vi.mock("@/modules/shipping/infrastructure/melhor-envio-oauth", () => ({
  getSellerMelhorEnvioAccessTokenWithScopes: mocks.getSellerAccessToken,
}));
vi.mock("@/modules/orders/application/sync-order-status", () => ({
  syncOrderStatusFromSellerOrders: mocks.syncOrderStatus,
}));

import {
  generateSellerOrderShipment,
  purchaseSellerOrderShipment,
  refreshSellerOrderTracking,
} from "./fulfill-seller-order";
import { ShippingProviderRequestError } from "@/lib/shipping/shipping-provider-error";

const pendingSellerOrder = {
  id: "seller-order-1",
  sellerId: "seller-1",
  status: "PAID",
  shipment: {
    id: "shipment-1",
    provider: "MELHOR_ENVIO",
    externalShipmentId: null,
    purchaseState: null,
    generationState: null,
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

function quotedService(overrides: Record<string, unknown> = {}) {
  return {
    provider: "MELHOR_ENVIO",
    serviceCode: "1",
    carrier: "Transportadora",
    service: "Expresso",
    priceInCents: 2500,
    packages: [{ heightInCm: 12, widthInCm: 20, lengthInCm: 30, weightInKg: 1.2, insuranceValueInCents: 10_000 }],
    raw: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue(pendingSellerOrder);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.txSellerOrderFindUnique
    // revalidação do status com o pedido da loja travado (após a chamada ao provedor)
    .mockResolvedValueOnce({ orderId: "order-1" })
    .mockResolvedValueOnce({ status: "PAID" })
    // syncFulfillmentStatuses
    .mockResolvedValueOnce({ orderId: "order-1" })
    .mockResolvedValueOnce({ id: "seller-order-1", orderId: "order-1", status: "PAID" })
    .mockResolvedValueOnce({
      order: { orderNumber: "MS-1" },
      shipment: { trackingCode: null, trackingUrl: null },
    });
  mocks.transaction.mockImplementation((callback) =>
    callback({
      shipment: { update: mocks.shipmentUpdate, findUnique: mocks.txShipmentFindUnique },
      sellerOrder: { findUnique: mocks.txSellerOrderFindUnique, update: mocks.txSellerOrderUpdate },
      outboxEvent: { upsert: mocks.outboxUpsert },
      $queryRaw: vi.fn(),
      auditLog: { create: mocks.auditCreate },
    }),
  );
  mocks.shipmentUpdate.mockResolvedValue({ ...pendingSellerOrder.shipment, externalShipmentId: "external-1" });
  mocks.quote.mockResolvedValue([quotedService()]);
  mocks.addToCart.mockResolvedValue({ cartItemId: "external-1", providerMetadata: {} });
  mocks.checkoutCart.mockResolvedValue({
    externalShipmentId: "external-1",
    status: "READY_TO_SHIP",
    providerMetadata: {},
  });
  mocks.generateShipment.mockResolvedValue({ externalShipmentId: "external-1", providerMetadata: { result: "ok" } });
  mocks.getSellerAccessToken.mockResolvedValue("seller-sandbox-token");
  mocks.send.mockResolvedValue({ ids: ["event-1"] });
});

describe("purchaseSellerOrderShipment retry safety", () => {
  it("claims the shipment before the external purchase and clears the claim after success", async () => {
    await purchaseSellerOrderShipment({
      sellerOrderId: "seller-order-1",
      sellerId: "seller-1",
      actorUserId: "seller-user-1",
    });

    expect(mocks.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "shipment-1", externalShipmentId: null, purchaseState: null },
      data: { purchaseState: "IN_PROGRESS", purchaseError: null },
    });
    expect(mocks.addToCart).toHaveBeenCalledOnce();
    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "seller-order-1", sellerId: "seller-1" } }),
    );
    expect(mocks.addToCart.mock.calls[0]?.[1]).toBe("seller-sandbox-token");
    expect(mocks.getSellerAccessToken).toHaveBeenCalledWith("seller-1", ["cart-write", "shipping-checkout"]);
    expect(mocks.shipmentUpdate).toHaveBeenCalledWith({
      where: { id: "shipment-1" },
      data: expect.objectContaining({ externalShipmentId: "external-1", purchaseState: null, purchaseError: null }),
    });
    expect(mocks.outboxUpsert).toHaveBeenCalledWith({
      where: { eventKey: "seller-order-fulfillment:seller-order-1:PROCESSING" },
      update: {},
      create: expect.objectContaining({
        eventName: "motoshop/seller-order.fulfillment-status.changed",
        aggregateType: "SELLER_ORDER",
        aggregateId: "seller-order-1",
        payload: expect.objectContaining({ orderNumber: "MS-1", status: "PROCESSING" }),
      }),
    });
  });

  it("blocks another external purchase after an uncertain provider result", async () => {
    const timeout = new Error("request timed out");
    mocks.addToCart.mockRejectedValueOnce(timeout);
    await expect(
      purchaseSellerOrderShipment({
        sellerOrderId: "seller-order-1",
        sellerId: "seller-1",
        actorUserId: "seller-user-1",
      }),
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
      purchaseSellerOrderShipment({
        sellerOrderId: "seller-order-1",
        sellerId: "seller-1",
        actorUserId: "seller-user-1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.addToCart).toHaveBeenCalledOnce();
  });

  it("does not start a second purchase when another request already owns the claim", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    mocks.findUnique.mockResolvedValue({ id: "shipment-1", externalShipmentId: null, purchaseState: "IN_PROGRESS" });

    await expect(
      purchaseSellerOrderShipment({
        sellerOrderId: "seller-order-1",
        sellerId: "seller-1",
        actorUserId: "seller-user-1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.addToCart).not.toHaveBeenCalled();
  });

  it("requires the shop's own OAuth token before claiming a paid shipping operation", async () => {
    mocks.getSellerAccessToken.mockResolvedValueOnce(null);

    await expect(
      purchaseSellerOrderShipment({
        sellerOrderId: "seller-order-1",
        sellerId: "seller-1",
        actorUserId: "seller-user-1",
      }),
    ).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });

    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.addToCart).not.toHaveBeenCalled();
  });

  it("does not load or purchase another seller's order", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);

    await expect(
      purchaseSellerOrderShipment({
        sellerOrderId: "seller-order-1",
        sellerId: "seller-2",
        actorUserId: "seller-user-2",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "seller-order-1", sellerId: "seller-2" } }),
    );
    expect(mocks.getSellerAccessToken).not.toHaveBeenCalled();
    expect(mocks.addToCart).not.toHaveBeenCalled();
  });
});

describe("generateSellerOrderShipment retry safety", () => {
  it("claims the generation before contacting the carrier and records completion", async () => {
    mocks.findUnique.mockResolvedValue({
      ...pendingSellerOrder,
      shipment: { ...pendingSellerOrder.shipment, externalShipmentId: "external-1" },
    });
    mocks.updateMany.mockImplementationOnce(async () => ({ count: 1 }));
    await generateSellerOrderShipment("seller-order-1", "seller-1", "seller-user-1");

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "shipment-1", externalShipmentId: "external-1", generationState: null },
      data: { generationState: "IN_PROGRESS", generationError: null },
    });
    expect(mocks.generateShipment).toHaveBeenCalledOnce();
    expect(mocks.generateShipment).toHaveBeenCalledWith("external-1", "seller-sandbox-token");
    expect(mocks.shipmentUpdate).toHaveBeenCalledWith({
      where: { id: "shipment-1", generationState: "IN_PROGRESS" },
      data: expect.objectContaining({
        generationState: "GENERATED",
        generatedAt: expect.any(Date),
        generationError: null,
      }),
    });
  });

  it("blocks another generation after an uncertain provider response", async () => {
    mocks.findUnique.mockResolvedValue({
      ...pendingSellerOrder,
      shipment: { ...pendingSellerOrder.shipment, externalShipmentId: "external-1" },
    });
    mocks.updateMany.mockImplementationOnce(async () => ({ count: 1 }));
    const timeout = new Error("request timed out");
    mocks.generateShipment.mockRejectedValueOnce(timeout);

    await expect(generateSellerOrderShipment("seller-order-1", "seller-1", "seller-user-1")).rejects.toBe(timeout);
    expect(mocks.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "shipment-1", generationState: "IN_PROGRESS" },
      data: {
        generationState: "OUTCOME_UNKNOWN",
        generationError: "O provedor não confirmou a geração; confira antes de tentar novamente.",
      },
    });

    mocks.findUnique.mockResolvedValue({
      ...pendingSellerOrder,
      shipment: {
        ...pendingSellerOrder.shipment,
        externalShipmentId: "external-1",
        generationState: "OUTCOME_UNKNOWN",
      },
    });
    await expect(generateSellerOrderShipment("seller-order-1", "seller-1", "seller-user-1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(mocks.generateShipment).toHaveBeenCalledOnce();
  });

  it("does not start generation when another request already owns the claim", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    mocks.findUnique
      .mockResolvedValueOnce({
        ...pendingSellerOrder,
        shipment: { ...pendingSellerOrder.shipment, externalShipmentId: "external-1" },
      })
      .mockResolvedValueOnce({ id: "shipment-1", externalShipmentId: "external-1", generationState: "IN_PROGRESS" });

    await expect(generateSellerOrderShipment("seller-order-1", "seller-1", "seller-user-1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(mocks.generateShipment).not.toHaveBeenCalled();
  });

  it("does not load or generate another seller's shipment", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);

    await expect(generateSellerOrderShipment("seller-order-1", "seller-2", "seller-user-2")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "seller-order-1", sellerId: "seller-2" },
      select: { status: true, shipment: true },
    });
    expect(mocks.getSellerAccessToken).not.toHaveBeenCalled();
    expect(mocks.generateShipment).not.toHaveBeenCalled();
  });
});

function lockedStatus(status: string) {
  mocks.txSellerOrderFindUnique.mockReset();
  mocks.txSellerOrderFindUnique
    .mockResolvedValueOnce({ orderId: "order-1" })
    .mockResolvedValueOnce({ status })
    .mockResolvedValueOnce({ orderId: "order-1" })
    .mockResolvedValueOnce({ id: "seller-order-1", orderId: "order-1", status })
    .mockResolvedValueOnce({ order: { orderNumber: "MS-1" }, shipment: { trackingCode: null, trackingUrl: null } });
}

describe("fulfillment after cancellation", () => {
  it("keeps the purchased label id without advancing a seller order whose cancellation is under review", async () => {
    lockedStatus("CANCELLATION_REQUESTED");
    await expect(
      purchaseSellerOrderShipment({ sellerOrderId: "seller-order-1", sellerId: "seller-1", actorUserId: "u" }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("cancelado") });

    expect(mocks.shipmentUpdate).toHaveBeenCalledOnce();
    const update = mocks.shipmentUpdate.mock.calls[0]?.[0];
    expect(update.data).toMatchObject({ externalShipmentId: "external-1", purchaseState: null });
    expect(update.data).not.toHaveProperty("status");
    expect(mocks.txSellerOrderUpdate).not.toHaveBeenCalled();
    expect(mocks.outboxUpsert).not.toHaveBeenCalled();
    expect(mocks.syncOrderStatus).not.toHaveBeenCalled();
  });

  it("flags a label purchased for an already cancelled seller order for provider cancellation", async () => {
    lockedStatus("CANCELLED");
    await expect(
      purchaseSellerOrderShipment({ sellerOrderId: "seller-order-1", sellerId: "seller-1", actorUserId: "u" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const update = mocks.shipmentUpdate.mock.calls[0]?.[0];
    expect(update.data).toMatchObject({
      externalShipmentId: "external-1",
      status: "CANCELLED",
      providerMetadata: expect.objectContaining({ labelCancellationRequired: true }),
    });
    expect(mocks.txSellerOrderUpdate).not.toHaveBeenCalled();
  });

  it.each(["CANCELLED", "CANCELLATION_REQUESTED", "PENDING_PAYMENT"])(
    "does not purchase a label for a %s seller order",
    async (status) => {
      mocks.findUnique.mockResolvedValue({ ...pendingSellerOrder, status });
      await expect(
        purchaseSellerOrderShipment({ sellerOrderId: "seller-order-1", sellerId: "seller-1", actorUserId: "u" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(mocks.addToCart).not.toHaveBeenCalled();
    },
  );

  it.each(["CANCELLED", "CANCELLATION_REQUESTED"])(
    "does not generate a label for a %s seller order",
    async (status) => {
      mocks.findUnique.mockResolvedValue({
        status,
        shipment: { ...pendingSellerOrder.shipment, externalShipmentId: "external-1" },
      });
      await expect(generateSellerOrderShipment("seller-order-1", "seller-1", "u")).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(mocks.getSellerAccessToken).not.toHaveBeenCalled();
      expect(mocks.generateShipment).not.toHaveBeenCalled();
    },
  );

  it("does not mark the shipment ready when the order is cancelled during generation", async () => {
    mocks.findUnique.mockResolvedValue({
      status: "PROCESSING",
      shipment: { ...pendingSellerOrder.shipment, externalShipmentId: "external-1" },
    });
    lockedStatus("CANCELLATION_REQUESTED");
    await expect(generateSellerOrderShipment("seller-order-1", "seller-1", "u")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const update = mocks.shipmentUpdate.mock.calls[0]?.[0];
    expect(update.data).toMatchObject({ generationState: "GENERATED" });
    expect(update.data).not.toHaveProperty("status");
    expect(mocks.syncOrderStatus).not.toHaveBeenCalled();
  });

  it("does not refresh tracking for a cancelled seller order", async () => {
    mocks.findUnique.mockResolvedValue({
      status: "CANCELLED",
      shipment: { ...pendingSellerOrder.shipment, externalShipmentId: "external-1" },
    });
    await expect(refreshSellerOrderTracking("seller-order-1", "seller-1", "u")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("still marks a shipped seller order as delivered from tracking", async () => {
    mocks.findUnique.mockResolvedValue({
      status: "SHIPPED",
      shipment: { ...pendingSellerOrder.shipment, externalShipmentId: "external-1" },
    });
    lockedStatus("SHIPPED");
    mocks.track.mockResolvedValue({ status: "delivered", providerMetadata: {} });
    mocks.txShipmentFindUnique.mockResolvedValue({ status: "IN_TRANSIT", shippedAt: new Date(), deliveredAt: null });
    mocks.shipmentUpdate.mockImplementation(async ({ data }) => ({ ...pendingSellerOrder.shipment, ...data }));

    await expect(refreshSellerOrderTracking("seller-order-1", "seller-1", "u")).resolves.toMatchObject({
      status: "DELIVERED",
    });
    expect(mocks.getSellerAccessToken).toHaveBeenCalledWith("seller-1", ["shipping-tracking"]);
    expect(mocks.txSellerOrderUpdate).toHaveBeenCalledWith({
      where: { id: "seller-order-1" },
      data: { status: "DELIVERED" },
    });
  });
});

describe("replacing a label cancelled at the provider", () => {
  const cancelledShipmentOrder = {
    ...pendingSellerOrder,
    status: "PROCESSING",
    shipment: {
      ...pendingSellerOrder.shipment,
      status: "CANCELLED",
      externalShipmentId: "external-old",
      generationState: "GENERATED",
    },
  };

  function mockResetTransaction(currentShipment: Record<string, unknown>) {
    mocks.transaction.mockImplementationOnce((callback) =>
      callback({
        shipment: { update: mocks.txShipmentUpdate, findUnique: vi.fn().mockResolvedValue(currentShipment) },
        sellerOrder: {
          findUnique: vi
            .fn()
            .mockResolvedValueOnce({ orderId: "order-1" })
            .mockResolvedValueOnce({ status: "PROCESSING" }),
        },
        $queryRaw: vi.fn(),
        auditLog: { create: mocks.auditCreate },
      }),
    );
  }

  it("archives the cancelled label id, resets the shipment and buys a new label", async () => {
    mocks.findUnique.mockResolvedValue(cancelledShipmentOrder);
    lockedStatus("PROCESSING");
    mockResetTransaction({
      status: "CANCELLED",
      purchaseState: null,
      externalShipmentId: "external-old",
      generationState: "GENERATED",
      trackingCode: "BR123",
      providerMetadata: { previousLabels: [{ externalShipmentId: "external-older" }] },
    });

    await purchaseSellerOrderShipment({ sellerOrderId: "seller-order-1", sellerId: "seller-1", actorUserId: "u" });

    expect(mocks.txShipmentUpdate).toHaveBeenCalledWith({
      where: { id: "shipment-1" },
      data: expect.objectContaining({
        status: "PENDING",
        externalShipmentId: null,
        purchaseState: null,
        generationState: null,
        trackingCode: null,
        providerMetadata: {
          previousLabels: [
            { externalShipmentId: "external-older" },
            expect.objectContaining({ externalShipmentId: "external-old", trackingCode: "BR123" }),
          ],
        },
      }),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "SHIPMENT_RESET_FOR_REPURCHASE",
        metadata: expect.objectContaining({ previousExternalShipmentId: "external-old" }),
      }),
    });
    expect(mocks.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "shipment-1", externalShipmentId: null, purchaseState: null },
      data: { purchaseState: "IN_PROGRESS", purchaseError: null },
    });
    expect(mocks.addToCart).toHaveBeenCalledOnce();
  });

  it("does not replace a label that still awaits cancellation at the provider", async () => {
    mocks.findUnique.mockResolvedValue(cancelledShipmentOrder);
    mockResetTransaction({
      status: "CANCELLED",
      purchaseState: null,
      externalShipmentId: "external-old",
      generationState: null,
      trackingCode: null,
      providerMetadata: { labelCancellationRequired: true },
    });

    await expect(
      purchaseSellerOrderShipment({ sellerOrderId: "seller-order-1", sellerId: "seller-1", actorUserId: "u" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.txShipmentUpdate).not.toHaveBeenCalled();
    expect(mocks.addToCart).not.toHaveBeenCalled();
  });
});

describe("definitive provider rejections", () => {
  it("releases the purchase claim with the provider message instead of blocking retries", async () => {
    const rejection = new ShippingProviderRequestError({
      message: "O Melhor Envio não conseguiu comprar a etiqueta.",
      providerStatus: 422,
    });
    mocks.addToCart.mockRejectedValueOnce(rejection);

    await expect(
      purchaseSellerOrderShipment({ sellerOrderId: "seller-order-1", sellerId: "seller-1", actorUserId: "u" }),
    ).rejects.toBe(rejection);
    expect(mocks.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "shipment-1", purchaseState: "IN_PROGRESS", externalShipmentId: null },
      data: { purchaseState: null, purchaseError: "O Melhor Envio não conseguiu comprar a etiqueta." },
    });
  });

  it("keeps the outcome unknown for rate limiting", async () => {
    mocks.addToCart.mockRejectedValueOnce(
      new ShippingProviderRequestError({
        message: "O Melhor Envio não conseguiu comprar a etiqueta.",
        providerStatus: 429,
      }),
    );

    await expect(
      purchaseSellerOrderShipment({ sellerOrderId: "seller-order-1", sellerId: "seller-1", actorUserId: "u" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.updateMany.mock.calls[1]?.[0]?.data).toMatchObject({ purchaseState: "OUTCOME_UNKNOWN" });
  });

  it("releases the generation claim after a definitive rejection", async () => {
    mocks.findUnique.mockResolvedValue({
      ...pendingSellerOrder,
      shipment: { ...pendingSellerOrder.shipment, externalShipmentId: "external-1" },
    });
    mocks.generateShipment.mockRejectedValueOnce(
      new ShippingProviderRequestError({
        message: "O Melhor Envio não conseguiu gerar a etiqueta.",
        providerStatus: 400,
      }),
    );

    await expect(generateSellerOrderShipment("seller-order-1", "seller-1", "u")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(mocks.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "shipment-1", generationState: "IN_PROGRESS" },
      data: { generationState: null, generationError: "O Melhor Envio não conseguiu gerar a etiqueta." },
    });
  });
});

describe("two-step label purchase (cart insert + checkout)", () => {
  const purchase = () =>
    purchaseSellerOrderShipment({ sellerOrderId: "seller-order-1", sellerId: "seller-1", actorUserId: "u" });

  it("buys with the volumes Melhor Envio packed for the same products quoted at checkout", async () => {
    mocks.findUnique.mockResolvedValue({
      ...pendingSellerOrder,
      items: [{ ...pendingSellerOrder.items[0], quantity: 3 }],
    });

    await purchase();

    expect(mocks.quote).toHaveBeenCalledWith(
      {
        fromPostalCode: "01001000",
        toPostalCode: "01001000",
        services: ["1"],
        products: [expect.objectContaining({ id: "SKU-1", insuranceValueInCents: 10_000, quantity: 3, weightInKg: 1 })],
      },
      "seller-sandbox-token",
    );
    expect(mocks.addToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        volumes: [{ heightInCm: 12, widthInCm: 20, lengthInCm: 30, weightInKg: 1.2 }],
        insuranceValueInCents: 30_000,
        products: [
          expect.objectContaining({ unitaryValueInCents: 10_000, insuranceValueInCents: 10_000, quantity: 3 }),
        ],
      }),
      "seller-sandbox-token",
    );
    expect(mocks.checkoutCart).toHaveBeenCalledWith("external-1", "seller-sandbox-token");
  });

  it("persists the cart item right after inserting it and never inserts a second one on retry", async () => {
    const rejection = new ShippingProviderRequestError({
      message: "O Melhor Envio não conseguiu comprar a etiqueta.",
      providerStatus: 422,
    });
    mocks.addToCart.mockResolvedValueOnce({ cartItemId: "cart-1", providerMetadata: {} });
    mocks.checkoutCart.mockRejectedValueOnce(rejection);

    await expect(purchase()).rejects.toBe(rejection);

    expect(mocks.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "shipment-1", purchaseState: "IN_PROGRESS", externalShipmentId: null },
      data: {
        providerMetadata: {
          purchaseCart: expect.objectContaining({ step: "CART_CREATED", cartItemId: "cart-1", serviceCode: "1" }),
        },
      },
    });
    expect(mocks.updateMany).toHaveBeenNthCalledWith(3, {
      where: { id: "shipment-1", purchaseState: "IN_PROGRESS", externalShipmentId: null },
      data: { purchaseState: null, purchaseError: "O Melhor Envio não conseguiu comprar a etiqueta." },
    });
    const persistedMetadata = mocks.updateMany.mock.calls[1]?.[0]?.data.providerMetadata;

    // Nova tentativa (ex.: depois de recarregar o saldo): somente o checkout do mesmo item.
    mocks.findUnique.mockResolvedValue({
      ...pendingSellerOrder,
      shipment: { ...pendingSellerOrder.shipment, providerMetadata: persistedMetadata },
    });
    mocks.checkoutCart.mockResolvedValueOnce({
      externalShipmentId: "cart-1",
      status: "READY_TO_SHIP",
      providerMetadata: { purchaseStatus: "paid" },
    });

    await purchase();

    expect(mocks.addToCart).toHaveBeenCalledOnce();
    expect(mocks.quote).toHaveBeenCalledOnce();
    expect(mocks.checkoutCart).toHaveBeenNthCalledWith(2, "cart-1", "seller-sandbox-token");
    expect(mocks.shipmentUpdate).toHaveBeenCalledWith({
      where: { id: "shipment-1" },
      data: expect.objectContaining({
        externalShipmentId: "cart-1",
        status: "READY_TO_SHIP",
        providerMetadata: { purchaseStatus: "paid" },
      }),
    });
  });

  it("keeps the outcome unknown and names the cart item when checkout times out", async () => {
    mocks.addToCart.mockResolvedValueOnce({ cartItemId: "cart-1", providerMetadata: {} });
    mocks.checkoutCart.mockRejectedValueOnce(new Error("request timed out"));

    await expect(purchase()).rejects.toThrow("request timed out");

    expect(mocks.updateMany).toHaveBeenNthCalledWith(3, {
      where: { id: "shipment-1", purchaseState: "IN_PROGRESS", externalShipmentId: null },
      data: {
        purchaseState: "OUTCOME_UNKNOWN",
        purchaseError: expect.stringContaining("cart-1"),
      },
    });
  });

  it("drops a cart item the provider no longer finds so the next attempt creates a new one", async () => {
    mocks.findUnique.mockResolvedValue({
      ...pendingSellerOrder,
      shipment: {
        ...pendingSellerOrder.shipment,
        providerMetadata: {
          purchaseCart: {
            step: "CART_CREATED",
            cartItemId: "cart-gone",
            serviceCode: "1",
            createdAt: new Date().toISOString(),
            volumeCount: 1,
          },
        },
      },
    });
    mocks.checkoutCart.mockRejectedValueOnce(
      new ShippingProviderRequestError({
        message: "O Melhor Envio não conseguiu comprar a etiqueta.",
        providerStatus: 404,
      }),
    );

    await expect(purchase()).rejects.toMatchObject({ providerStatus: 404 });

    expect(mocks.addToCart).not.toHaveBeenCalled();
    expect(mocks.updateMany.mock.calls[1]?.[0]?.data).toMatchObject({
      purchaseState: null,
      providerMetadata: {
        discardedPurchaseCarts: [expect.objectContaining({ cartItemId: "cart-gone", reason: "NOT_FOUND_AT_PROVIDER" })],
      },
    });
    expect(mocks.updateMany.mock.calls[1]?.[0]?.data.providerMetadata).not.toHaveProperty("purchaseCart");
  });

  it("creates a new cart item when the stored one is past the provider's 7-day window", async () => {
    mocks.findUnique.mockResolvedValue({
      ...pendingSellerOrder,
      shipment: {
        ...pendingSellerOrder.shipment,
        providerMetadata: {
          purchaseCart: {
            step: "CART_CREATED",
            cartItemId: "cart-old",
            serviceCode: "1",
            createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
            volumeCount: 1,
          },
        },
      },
    });

    await purchase();

    expect(mocks.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "shipment-1", externalShipmentId: null, purchaseState: null },
      data: {
        providerMetadata: {
          discardedPurchaseCarts: [expect.objectContaining({ cartItemId: "cart-old", reason: "EXPIRED" })],
        },
      },
    });
    expect(mocks.addToCart).toHaveBeenCalledOnce();
    expect(mocks.checkoutCart).toHaveBeenCalledWith("external-1", "seller-sandbox-token");
  });

  it("refuses multi-package Correios shipments before claiming or inserting anything", async () => {
    mocks.quote.mockResolvedValueOnce([
      quotedService({
        carrier: "Correios",
        packages: [
          { heightInCm: 10, widthInCm: 10, lengthInCm: 10, weightInKg: 1 },
          { heightInCm: 10, widthInCm: 10, lengthInCm: 10, weightInKg: 1 },
        ],
      }),
    ]);

    await expect(purchase()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.addToCart).not.toHaveBeenCalled();
  });

  it("does not buy when the contracted service is missing from the new quote", async () => {
    mocks.quote.mockResolvedValueOnce([quotedService({ serviceCode: "2" })]);

    await expect(purchase()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.addToCart).not.toHaveBeenCalled();
  });
});
