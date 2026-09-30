import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { ShipmentStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { inngest } from "@/lib/inngest/client";
import { melhorEnvioProvider } from "@/lib/shipping/melhor-envio-provider";
import { getSellerOrderStatusFromShipment } from "@/modules/orders/domain/fulfillment-status";
import { syncOrderStatusFromSellerOrders } from "@/modules/orders/application/sync-order-status";
import type { ShippingAddress, ShippingProduct, ShippingVolume } from "@/shared/shipping/shipping-provider";
import { ApplicationError } from "@/shared/errors/application-error";

export type FulfillSellerOrderInput = {
  sellerOrderId: string;
  actorUserId: string;
  tags?: Array<{ tag: string; url?: string }>;
};

export async function purchaseSellerOrderShipment(input: FulfillSellerOrderInput) {
  const sellerOrder = await getSellerOrderForFulfillment(input.sellerOrderId);
  assertIntegratedShipment(sellerOrder.shipment?.provider);
  if (sellerOrder.status !== "PAID" && sellerOrder.status !== "PROCESSING") {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O pedido do seller ainda não está pago.",
      statusCode: 409,
    });
  }
  if (!sellerOrder.shipment?.serviceCode) {
    throw new ApplicationError({ code: "CONFIGURATION_ERROR", message: "O serviço de frete não foi salvo no pedido." });
  }
  if (sellerOrder.shipment.externalShipmentId) return sellerOrder.shipment;
  if (sellerOrder.shipment.purchaseState) {
    throw new ApplicationError({
      code: "CONFLICT",
      message:
        sellerOrder.shipment.purchaseState === "IN_PROGRESS"
          ? "A compra da etiqueta já foi iniciada. Aguarde ou solicite a conferência antes de tentar novamente."
          : "O resultado da compra da etiqueta é incerto. Confira os envios no Melhor Envio antes de tentar novamente.",
      statusCode: 409,
    });
  }

  const shipmentData = buildShipmentData(sellerOrder);
  const claim = await db.shipment.updateMany({
    where: { id: sellerOrder.shipment.id, externalShipmentId: null, purchaseState: null },
    data: { purchaseState: "IN_PROGRESS", purchaseError: null },
  });
  if (claim.count !== 1) {
    const current = await db.shipment.findUnique({ where: { id: sellerOrder.shipment.id } });
    if (current?.externalShipmentId) return current;
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A compra da etiqueta já está em andamento ou precisa de conferência manual.",
      statusCode: 409,
    });
  }

  let result: Awaited<ReturnType<typeof melhorEnvioProvider.createShipment>>;
  try {
    result = await melhorEnvioProvider.createShipment({
      sellerOrderId: input.sellerOrderId,
      serviceCode: sellerOrder.shipment.serviceCode,
      ...shipmentData,
      ...(input.tags ? { tags: input.tags } : { tags: [{ tag: sellerOrder.order.orderNumber }] }),
      quote: {
        provider: sellerOrder.shipment.provider,
        serviceCode: sellerOrder.shipment.serviceCode,
        carrier: sellerOrder.shipment.carrier,
        service: sellerOrder.shipment.service,
        priceInCents: sellerOrder.shipment.priceInCents,
        ...(sellerOrder.shipment.estimatedDeliveryDays !== null
          ? { estimatedDeliveryDays: sellerOrder.shipment.estimatedDeliveryDays }
          : {}),
        raw: {},
      },
    });
  } catch (error) {
    await db.shipment.updateMany({
      where: { id: sellerOrder.shipment.id, purchaseState: "IN_PROGRESS", externalShipmentId: null },
      data: {
        purchaseState: "OUTCOME_UNKNOWN",
        purchaseError: "O provedor não confirmou o resultado; confira antes de uma nova tentativa.",
      },
    });
    logger.error(
      {
        event: "shipment.purchase_outcome_unknown",
        sellerOrderId: input.sellerOrderId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      },
      "Shipment purchase outcome is unknown; automatic retry is blocked",
    );
    throw error;
  }

  const shipment = await db.$transaction(async (tx) => {
    const shipment = await tx.shipment.update({
      where: { id: sellerOrder.shipment!.id },
      data: {
        externalShipmentId: result.externalShipmentId,
        status: "READY_TO_SHIP",
        purchaseState: null,
        purchaseError: null,
        providerMetadata: result.providerMetadata as Prisma.InputJsonValue,
      },
    });
    await syncFulfillmentStatuses(tx, input.sellerOrderId, "READY_TO_SHIP", input.actorUserId);
    return shipment;
  });
  await enqueueFulfillmentNotification(input.sellerOrderId);
  return shipment;
}

export async function generateSellerOrderShipment(sellerOrderId: string, actorUserId: string) {
  const shipment = await getShipment(sellerOrderId);
  assertIntegratedShipment(shipment.provider);
  if (!shipment.externalShipmentId)
    throw new ApplicationError({ code: "CONFLICT", message: "A etiqueta ainda não foi comprada." });

  const result = await melhorEnvioProvider.generateShipment(shipment.externalShipmentId);
  const updatedShipment = await db.$transaction(async (tx) => {
    const updatedShipment = await tx.shipment.update({
      where: { id: shipment.id },
      data: { status: "READY_TO_SHIP", providerMetadata: result.providerMetadata as Prisma.InputJsonValue },
    });
    await syncFulfillmentStatuses(tx, sellerOrderId, "READY_TO_SHIP", actorUserId);
    return updatedShipment;
  });
  await enqueueFulfillmentNotification(sellerOrderId);
  return updatedShipment;
}

export async function refreshSellerOrderTracking(sellerOrderId: string, actorUserId: string) {
  const shipment = await getShipment(sellerOrderId);
  assertIntegratedShipment(shipment.provider);
  if (!shipment.externalShipmentId)
    throw new ApplicationError({ code: "CONFLICT", message: "A etiqueta ainda não foi comprada." });

  const result = await melhorEnvioProvider.track(shipment.externalShipmentId);
  const status = mapShipmentStatus(result.status);
  const updatedShipment = await db.$transaction(async (tx) => {
    const updatedShipment = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status,
        ...(result.trackingCode ? { trackingCode: result.trackingCode } : {}),
        ...(result.trackingUrl ? { trackingUrl: result.trackingUrl } : {}),
        providerMetadata: result.providerMetadata as Prisma.InputJsonValue,
        ...(status === "SHIPPED" ? { shippedAt: new Date() } : {}),
        ...(status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      },
    });
    await syncFulfillmentStatuses(tx, sellerOrderId, status, actorUserId);
    return updatedShipment;
  });
  await enqueueFulfillmentNotification(sellerOrderId);
  return updatedShipment;
}

export async function enqueueFulfillmentNotification(sellerOrderId: string) {
  const sellerOrder = await db.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    select: {
      id: true,
      status: true,
      order: { select: { orderNumber: true } },
      shipment: { select: { trackingCode: true, trackingUrl: true } },
    },
  });
  if (!sellerOrder || !["PROCESSING", "SHIPPED", "DELIVERED"].includes(sellerOrder.status)) return;

  try {
    await inngest.send({
      name: "motoshop/seller-order.fulfillment-status.changed",
      data: {
        sellerOrderId: sellerOrder.id,
        orderNumber: sellerOrder.order.orderNumber,
        status: sellerOrder.status,
        trackingCode: sellerOrder.shipment?.trackingCode ?? null,
        trackingUrl: sellerOrder.shipment?.trackingUrl ?? null,
      },
    });
  } catch (error) {
    logger.error(
      { event: "seller_order.fulfillment_notification.enqueue_failed", sellerOrderId, error },
      "Could not enqueue fulfillment notification",
    );
  }
}

export async function syncFulfillmentStatuses(
  tx: Prisma.TransactionClient,
  sellerOrderId: string,
  shipmentStatus: ShipmentStatus,
  actorUserId: string,
) {
  const reference = await tx.sellerOrder.findUnique({ where: { id: sellerOrderId }, select: { orderId: true } });
  if (!reference) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido do seller não encontrado." });
  await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${reference.orderId} FOR UPDATE`;

  const sellerOrder = await tx.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    select: { id: true, orderId: true, status: true },
  });
  if (!sellerOrder) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido do seller não encontrado." });

  const nextSellerOrderStatus = getSellerOrderStatusFromShipment(sellerOrder.status, shipmentStatus);
  if (nextSellerOrderStatus !== sellerOrder.status) {
    await tx.sellerOrder.update({ where: { id: sellerOrder.id }, data: { status: nextSellerOrderStatus } });
    await tx.auditLog.create({
      data: {
        action: "SELLER_ORDER_STATUS_CHANGED",
        entityType: "SELLER_ORDER",
        entityId: sellerOrder.id,
        actorUserId,
        metadata: { previousStatus: sellerOrder.status, nextStatus: nextSellerOrderStatus, shipmentStatus },
      },
    });
  }

  await syncOrderStatusFromSellerOrders(tx, sellerOrder.orderId, "FULFILLMENT", actorUserId);
}

async function getSellerOrderForFulfillment(sellerOrderId: string) {
  const sellerOrder = await db.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    include: {
      shipment: true,
      seller: true,
      store: true,
      order: { include: { shippingAddress: true } },
      items: true,
    },
  });
  if (!sellerOrder) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido do seller não encontrado." });
  return sellerOrder;
}

async function getShipment(sellerOrderId: string) {
  const sellerOrder = await db.sellerOrder.findUnique({ where: { id: sellerOrderId }, include: { shipment: true } });
  if (!sellerOrder?.shipment)
    throw new ApplicationError({ code: "NOT_FOUND", message: "Envio do seller não encontrado." });
  return sellerOrder.shipment;
}

function assertIntegratedShipment(provider: string | undefined) {
  if (provider !== "MELHOR_ENVIO")
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Use a atualização manual para entregas próprias da loja.",
    });
}

function buildShipmentData(sellerOrder: Awaited<ReturnType<typeof getSellerOrderForFulfillment>>) {
  const address = sellerOrder.order.shippingAddress;
  if (!address)
    throw new ApplicationError({ code: "CONFIGURATION_ERROR", message: "O pedido não possui endereço de entrega." });

  const from = buildOriginAddress(sellerOrder.store, sellerOrder.seller.type);
  const to: ShippingAddress = {
    name: sellerOrder.order.customerName,
    email: sellerOrder.order.customerEmail,
    phone: sellerOrder.order.customerPhone,
    ...(sellerOrder.order.customerTaxId ? { document: sellerOrder.order.customerTaxId } : {}),
    address: address.street,
    number: address.number,
    ...(address.complement ? { complement: address.complement } : {}),
    district: address.neighborhood,
    city: address.city,
    postal_code: address.postalCode,
    country_id: address.country,
    state_abbr: address.state,
  };

  const products: ShippingProduct[] = sellerOrder.items.map((item) => {
    const dimensions = getItemDimensions(item);
    return {
      id: item.skuSnapshot || item.productNameSnapshot,
      name: item.productNameSnapshot,
      unitaryValueInCents: item.unitPriceInCents,
      ...dimensions,
      insuranceValueInCents: item.unitPriceInCents * item.quantity,
      quantity: item.quantity,
    };
  });
  const volumes: ShippingVolume[] = sellerOrder.items.map((item) => {
    const dimensions = getItemDimensions(item);
    return { ...dimensions, weightInKg: dimensions.weightInKg * item.quantity };
  });

  return {
    from,
    to,
    products,
    volumes,
    insuranceValueInCents: products.reduce((total, product) => total + product.insuranceValueInCents, 0),
  };
}

function buildOriginAddress(
  store: {
    originName: string | null;
    originEmail: string | null;
    originPhone: string | null;
    originDocument: string | null;
    originPostalCode: string | null;
    originStreet: string | null;
    originNumber: string | null;
    originComplement: string | null;
    originNeighborhood: string | null;
    originCity: string | null;
    originState: string | null;
    originStateRegister: string | null;
  },
  sellerType: "INDIVIDUAL" | "COMPANY",
): ShippingAddress {
  const required = [
    store.originName,
    store.originEmail,
    store.originPhone,
    store.originDocument,
    store.originPostalCode,
    store.originStreet,
    store.originNumber,
    store.originNeighborhood,
    store.originCity,
    store.originState,
  ];
  if (required.some((value) => !value)) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "Complete os dados de envio da loja antes de comprar a etiqueta.",
      statusCode: 409,
    });
  }

  return {
    name: store.originName!,
    email: store.originEmail!,
    phone: store.originPhone!,
    ...(sellerType === "COMPANY" ? { company_document: store.originDocument! } : { document: store.originDocument! }),
    address: store.originStreet!,
    number: store.originNumber!,
    ...(store.originComplement ? { complement: store.originComplement } : {}),
    district: store.originNeighborhood!,
    city: store.originCity!,
    postal_code: store.originPostalCode!,
    state_abbr: store.originState!,
    state_register: store.originStateRegister || "ISENTO",
    country_id: "BR",
  };
}

function getItemDimensions(item: {
  weightInGramsSnapshot: number | null;
  heightInMillimetersSnapshot: number | null;
  widthInMillimetersSnapshot: number | null;
  lengthInMillimetersSnapshot: number | null;
}) {
  if (
    item.weightInGramsSnapshot === null ||
    item.heightInMillimetersSnapshot === null ||
    item.widthInMillimetersSnapshot === null ||
    item.lengthInMillimetersSnapshot === null
  ) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "Existe um item sem peso ou dimensões cadastradas para o envio.",
      statusCode: 409,
    });
  }
  return {
    weightInKg: item.weightInGramsSnapshot / 1000,
    heightInCm: item.heightInMillimetersSnapshot / 10,
    widthInCm: item.widthInMillimetersSnapshot / 10,
    lengthInCm: item.lengthInMillimetersSnapshot / 10,
  };
}

function mapShipmentStatus(
  status: string,
): "PENDING" | "READY_TO_SHIP" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "EXCEPTION" | "CANCELLED" {
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus.includes("delivered") || normalizedStatus.includes("entregue")) return "DELIVERED";
  if (normalizedStatus.includes("transit") || normalizedStatus.includes("trânsito")) return "IN_TRANSIT";
  if (normalizedStatus.includes("posted") || normalizedStatus.includes("postado")) return "SHIPPED";
  if (normalizedStatus.includes("cancel")) return "CANCELLED";
  if (normalizedStatus.includes("exception") || normalizedStatus.includes("problema")) return "EXCEPTION";
  return "READY_TO_SHIP";
}
