import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { melhorEnvioProvider } from "@/lib/shipping/melhor-envio-provider";
import { isDefinitiveProviderRejection } from "@/lib/shipping/shipping-provider-error";
import {
  canRunShipmentOperation,
  mapProviderShipmentStatus,
  resolveShipmentStatus,
} from "@/modules/orders/domain/fulfillment-status";
import { syncFulfillmentStatuses } from "@/modules/orders/application/sync-fulfillment-status";
import { ApplicationError } from "@/shared/errors/application-error";
import { getSellerMelhorEnvioAccessTokenWithScopes } from "@/modules/shipping/infrastructure/melhor-envio-oauth";
import { buildShipmentData } from "@/modules/shipping/domain/shipment-payload";

import {
  STALE_GENERATION_MESSAGE,
  STALE_PURCHASE_MESSAGE,
  assertShipmentOperationAllowed,
  hasLabelCancellationFlag,
  lockSellerOrderStatus,
  readProviderMetadata,
  withLabelCancellationFlag,
} from "./shipment-operation-guard";

export type FulfillSellerOrderInput = {
  sellerOrderId: string;
  sellerId: string;
  actorUserId: string;
  tags?: Array<{ tag: string; url?: string }>;
};

export async function purchaseSellerOrderShipment(input: FulfillSellerOrderInput) {
  const sellerOrder = await getSellerOrderForFulfillment(input.sellerOrderId, input.sellerId);
  assertIntegratedShipment(sellerOrder.shipment?.provider);
  assertShipmentOperationAllowed(sellerOrder.status, "PURCHASE");
  if (!sellerOrder.shipment?.serviceCode) {
    throw new ApplicationError({ code: "CONFIGURATION_ERROR", message: "O serviço de frete não foi salvo no pedido." });
  }
  const accessToken = await requireSellerShippingToken(sellerOrder.sellerId, ["cart-write", "shipping-checkout"]);
  if (sellerOrder.shipment.status === "CANCELLED") {
    await resetCancelledShipmentForRepurchase(input, sellerOrder.shipment.id);
  } else if (sellerOrder.shipment.externalShipmentId) {
    return sellerOrder.shipment;
  }
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
    result = await melhorEnvioProvider.createShipment(
      {
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
      },
      accessToken,
    );
  } catch (error) {
    if (isDefinitiveProviderRejection(error)) {
      // Recusa explícita (4xx): a etiqueta não foi paga; libera nova tentativa após a correção.
      await db.shipment.updateMany({
        where: { id: sellerOrder.shipment.id, purchaseState: "IN_PROGRESS", externalShipmentId: null },
        data: { purchaseState: null, purchaseError: error.message },
      });
      logger.warn(
        {
          event: "shipment.purchase_rejected",
          sellerOrderId: input.sellerOrderId,
          providerStatus: error.providerStatus,
        },
        "Shipping provider rejected the label purchase; retry released",
      );
      throw error;
    }
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

  // A chamada externa acontece fora da transação (AGENTS.md §36). O pedido pode ter sido
  // cancelado enquanto isso: revalida o status com o registro travado antes de avançar o envio.
  const outcome = await db.$transaction(async (tx) => {
    const currentStatus = await lockSellerOrderStatus(tx, input.sellerOrderId);
    if (!canRunShipmentOperation(currentStatus, "PURCHASE")) {
      // A etiqueta já foi paga no provedor: guarda o id externo para estorno/cancelamento,
      // sem marcar o envio como pronto nem alterar o status do pedido. Se o cancelamento já foi
      // concluído, sinaliza a etiqueta para a fila de conferência do Admin.
      const shipment = await tx.shipment.update({
        where: { id: sellerOrder.shipment!.id },
        data: {
          externalShipmentId: result.externalShipmentId,
          purchaseState: null,
          purchaseError: STALE_PURCHASE_MESSAGE,
          ...(currentStatus === "CANCELLED"
            ? {
                status: "CANCELLED" as const,
                providerMetadata: withLabelCancellationFlag(result.providerMetadata, "PURCHASED_AFTER_CANCELLATION"),
              }
            : { providerMetadata: result.providerMetadata as Prisma.InputJsonValue }),
        },
      });
      return { shipment, staleStatus: currentStatus };
    }
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
    return { shipment, staleStatus: null };
  });
  if (outcome.staleStatus) {
    logger.error(
      {
        event: "shipment.purchased_for_inactive_order",
        sellerOrderId: input.sellerOrderId,
        status: outcome.staleStatus,
      },
      "Shipment was purchased after the seller order left the fulfillment flow; manual label cancellation required",
    );
    throw new ApplicationError({ code: "CONFLICT", message: STALE_PURCHASE_MESSAGE, statusCode: 409 });
  }
  return outcome.shipment;
}

/**
 * Uma etiqueta cancelada no Melhor Envio não pode ser reaproveitada: arquiva o id externo no
 * histórico do `providerMetadata` e devolve o envio a `PENDING` para permitir nova compra.
 */
async function resetCancelledShipmentForRepurchase(input: FulfillSellerOrderInput, shipmentId: string) {
  await db.$transaction(async (tx) => {
    const status = await lockSellerOrderStatus(tx, input.sellerOrderId);
    assertShipmentOperationAllowed(status, "PURCHASE");
    await tx.$queryRaw`SELECT id FROM "shipments" WHERE id = ${shipmentId} FOR UPDATE`;
    const current = await tx.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        status: true,
        purchaseState: true,
        externalShipmentId: true,
        generationState: true,
        trackingCode: true,
        providerMetadata: true,
      },
    });
    if (!current || current.status !== "CANCELLED" || current.purchaseState) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O envio foi atualizado por outra operação. Recarregue o pedido antes de tentar novamente.",
        statusCode: 409,
      });
    }
    if (hasLabelCancellationFlag(current.providerMetadata)) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "A etiqueta anterior ainda precisa ter o cancelamento conferido no Melhor Envio.",
        statusCode: 409,
      });
    }
    const metadata = readProviderMetadata(current.providerMetadata);
    const previousLabels = Array.isArray(metadata.previousLabels) ? metadata.previousLabels : [];
    const archivedLabel = {
      externalShipmentId: current.externalShipmentId,
      generationState: current.generationState,
      trackingCode: current.trackingCode,
      archivedAt: new Date().toISOString(),
    };
    await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: "PENDING",
        externalShipmentId: null,
        purchaseState: null,
        purchaseError: null,
        generationState: null,
        generationError: null,
        generatedAt: null,
        trackingCode: null,
        trackingUrl: null,
        shippedAt: null,
        deliveredAt: null,
        providerMetadata: { previousLabels: [...previousLabels, archivedLabel] } as Prisma.InputJsonValue,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "SHIPMENT_RESET_FOR_REPURCHASE",
        entityType: "SHIPMENT",
        entityId: shipmentId,
        actorUserId: input.actorUserId,
        metadata: { sellerOrderId: input.sellerOrderId, previousExternalShipmentId: current.externalShipmentId },
      },
    });
  });
}

export async function generateSellerOrderShipment(sellerOrderId: string, sellerId: string, actorUserId: string) {
  const { shipment, status } = await getShipment(sellerOrderId, sellerId);
  assertIntegratedShipment(shipment.provider);
  assertShipmentOperationAllowed(status, "GENERATE");
  if (!shipment.externalShipmentId)
    throw new ApplicationError({ code: "CONFLICT", message: "A etiqueta ainda não foi comprada." });
  if (shipment.status === "CANCELLED")
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A etiqueta foi cancelada. Compre uma nova etiqueta antes de gerar.",
      statusCode: 409,
    });
  if (shipment.generationState === "GENERATED") return shipment;
  if (shipment.generationState) {
    throw new ApplicationError({
      code: "CONFLICT",
      message:
        shipment.generationState === "IN_PROGRESS"
          ? "A geração da etiqueta já foi iniciada. Aguarde antes de tentar novamente."
          : "O resultado da geração é incerto. Peça a conferência administrativa antes de tentar novamente.",
      statusCode: 409,
    });
  }

  const accessToken = await requireSellerShippingToken(sellerId, ["shipping-generate"]);
  const claim = await db.shipment.updateMany({
    where: { id: shipment.id, externalShipmentId: shipment.externalShipmentId, generationState: null },
    data: { generationState: "IN_PROGRESS", generationError: null },
  });
  if (claim.count !== 1) {
    const current = await db.shipment.findUnique({ where: { id: shipment.id } });
    if (current?.generationState === "GENERATED") return current;
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A geração da etiqueta já está em andamento ou precisa de conferência administrativa.",
      statusCode: 409,
    });
  }

  let result: Awaited<ReturnType<typeof melhorEnvioProvider.generateShipment>>;
  try {
    result = await melhorEnvioProvider.generateShipment(shipment.externalShipmentId, accessToken);
  } catch (error) {
    if (isDefinitiveProviderRejection(error)) {
      await db.shipment.updateMany({
        where: { id: shipment.id, generationState: "IN_PROGRESS" },
        data: { generationState: null, generationError: error.message },
      });
      logger.warn(
        { event: "shipment.generation_rejected", sellerOrderId, providerStatus: error.providerStatus },
        "Shipping provider rejected the label generation; retry released",
      );
      throw error;
    }
    await db.shipment.updateMany({
      where: { id: shipment.id, generationState: "IN_PROGRESS" },
      data: {
        generationState: "OUTCOME_UNKNOWN",
        generationError: "O provedor não confirmou a geração; confira antes de tentar novamente.",
      },
    });
    logger.error(
      {
        event: "shipment.generation_outcome_unknown",
        sellerOrderId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      },
      "Shipment generation outcome is unknown; automatic retry is blocked",
    );
    throw error;
  }
  const outcome = await db.$transaction(async (tx) => {
    const currentStatus = await lockSellerOrderStatus(tx, sellerOrderId);
    if (!canRunShipmentOperation(currentStatus, "GENERATE")) {
      const updatedShipment = await tx.shipment.update({
        where: { id: shipment.id, generationState: "IN_PROGRESS" },
        data: {
          generationState: "GENERATED",
          generatedAt: new Date(),
          generationError: STALE_GENERATION_MESSAGE,
          ...(currentStatus === "CANCELLED"
            ? {
                status: "CANCELLED" as const,
                providerMetadata: withLabelCancellationFlag(result.providerMetadata, "GENERATED_AFTER_CANCELLATION"),
              }
            : { providerMetadata: result.providerMetadata as Prisma.InputJsonValue }),
        },
      });
      return { updatedShipment, staleStatus: currentStatus };
    }
    const updatedShipment = await tx.shipment.update({
      where: { id: shipment.id, generationState: "IN_PROGRESS" },
      data: {
        status: "READY_TO_SHIP",
        generationState: "GENERATED",
        generatedAt: new Date(),
        generationError: null,
        providerMetadata: result.providerMetadata as Prisma.InputJsonValue,
      },
    });
    await syncFulfillmentStatuses(tx, sellerOrderId, "READY_TO_SHIP", actorUserId);
    return { updatedShipment, staleStatus: null };
  });
  if (outcome.staleStatus) {
    logger.error(
      { event: "shipment.generated_for_inactive_order", sellerOrderId, status: outcome.staleStatus },
      "Shipment label was generated after the seller order left the fulfillment flow",
    );
    throw new ApplicationError({ code: "CONFLICT", message: STALE_GENERATION_MESSAGE, statusCode: 409 });
  }
  return outcome.updatedShipment;
}

export async function refreshSellerOrderTracking(sellerOrderId: string, sellerId: string, actorUserId: string) {
  const { shipment, status: sellerOrderStatus } = await getShipment(sellerOrderId, sellerId);
  assertIntegratedShipment(shipment.provider);
  assertShipmentOperationAllowed(sellerOrderStatus, "TRACK");
  if (!shipment.externalShipmentId)
    throw new ApplicationError({ code: "CONFLICT", message: "A etiqueta ainda não foi comprada." });

  const accessToken = await requireSellerShippingToken(sellerId, ["shipping-tracking"]);
  const result = await melhorEnvioProvider.track(shipment.externalShipmentId, accessToken);
  const reportedStatus = mapProviderShipmentStatus(result.status);
  if (!reportedStatus) {
    logger.warn(
      { event: "shipment.tracking_unknown_status", sellerOrderId, providerStatus: result.status },
      "Unknown shipping provider status; keeping the current shipment status",
    );
  }
  const updatedShipment = await db.$transaction(async (tx) => {
    const currentSellerOrderStatus = await lockSellerOrderStatus(tx, sellerOrderId);
    assertShipmentOperationAllowed(currentSellerOrderStatus, "TRACK");
    await tx.$queryRaw`SELECT id FROM "shipments" WHERE id = ${shipment.id} FOR UPDATE`;
    const currentShipment = await tx.shipment.findUnique({
      where: { id: shipment.id },
      select: { status: true, shippedAt: true, deliveredAt: true },
    });
    if (!currentShipment) throw new ApplicationError({ code: "NOT_FOUND", message: "Envio do lojista não encontrado." });
    const status = resolveShipmentStatus(currentShipment.status, reportedStatus);
    const updatedShipment = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status,
        ...(result.trackingCode ? { trackingCode: result.trackingCode } : {}),
        ...(result.trackingUrl ? { trackingUrl: result.trackingUrl } : {}),
        providerMetadata: result.providerMetadata as Prisma.InputJsonValue,
        ...(status === "SHIPPED" || status === "IN_TRANSIT"
          ? { shippedAt: currentShipment.shippedAt ?? new Date() }
          : {}),
        ...(status === "DELIVERED" ? { deliveredAt: currentShipment.deliveredAt ?? new Date() } : {}),
      },
    });
    await syncFulfillmentStatuses(tx, sellerOrderId, status, actorUserId);
    return updatedShipment;
  });
  return updatedShipment;
}

async function getSellerOrderForFulfillment(sellerOrderId: string, sellerId: string) {
  const sellerOrder = await db.sellerOrder.findFirst({
    where: { id: sellerOrderId, sellerId },
    include: {
      shipment: true,
      seller: true,
      store: true,
      order: { include: { shippingAddress: true } },
      items: true,
    },
  });
  if (!sellerOrder) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido do lojista não encontrado." });
  return sellerOrder;
}

async function getShipment(sellerOrderId: string, sellerId: string) {
  const sellerOrder = await db.sellerOrder.findFirst({
    where: { id: sellerOrderId, sellerId },
    select: { status: true, shipment: true },
  });
  if (!sellerOrder?.shipment)
    throw new ApplicationError({ code: "NOT_FOUND", message: "Envio do lojista não encontrado." });
  return { shipment: sellerOrder.shipment, status: sellerOrder.status };
}

async function requireSellerShippingToken(sellerId: string, requiredScopes: readonly string[]): Promise<string> {
  const accessToken = await getSellerMelhorEnvioAccessTokenWithScopes(sellerId, requiredScopes);
  if (!accessToken)
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "Conecte a conta do Melhor Envio da loja para gerenciar este envio.",
      statusCode: 409,
    });
  return accessToken;
}

function assertIntegratedShipment(provider: string | undefined) {
  if (provider !== "MELHOR_ENVIO")
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Use a atualização manual para entregas próprias da loja.",
    });
}
