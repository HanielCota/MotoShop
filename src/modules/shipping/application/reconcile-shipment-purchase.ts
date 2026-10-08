import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { melhorEnvioProvider } from "@/lib/shipping/melhor-envio-provider";
import { ApplicationError } from "@/shared/errors/application-error";
import { getSellerMelhorEnvioAccessTokenWithScopes } from "@/modules/shipping/infrastructure/melhor-envio-oauth";
import { canRunShipmentOperation } from "@/modules/orders/domain/fulfillment-status";
import { syncFulfillmentStatuses } from "@/modules/orders/application/sync-fulfillment-status";

import { STALE_PURCHASE_MESSAGE, lockSellerOrderStatus, withLabelCancellationFlag } from "./shipment-operation-guard";

type ReconciliationInput = {
  shipmentId: string;
  actorUserId: string;
  confirmedOrderNumber: string;
  decision: "CONFIRMED_PURCHASE" | "CONFIRMED_NOT_PURCHASED";
  externalShipmentId?: string;
};

const purchaseClaimTimeoutMs = 5 * 60 * 1000;

export async function reconcileShipmentPurchase(input: ReconciliationInput): Promise<void> {
  const shipment = await db.shipment.findUnique({
    where: { id: input.shipmentId },
    include: { sellerOrder: { select: { sellerId: true, orderId: true, order: { select: { orderNumber: true } } } } },
  });
  if (!shipment || shipment.provider !== "MELHOR_ENVIO") {
    throw new ApplicationError({ code: "NOT_FOUND", message: "Tentativa de envio não encontrada." });
  }
  if (!shipment.purchaseState || shipment.externalShipmentId) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Esta tentativa não está aguardando reconciliação.",
      statusCode: 409,
    });
  }
  if (input.confirmedOrderNumber !== shipment.sellerOrder.order.orderNumber) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "Digite exatamente o número do pedido exibido para confirmar a conferência.",
    });
  }

  const staleCutoff = new Date(Date.now() - purchaseClaimTimeoutMs);
  if (shipment.purchaseState === "IN_PROGRESS" && shipment.updatedAt > staleCutoff) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A chamada de compra ainda pode estar em andamento. Aguarde cinco minutos antes de reconciliar.",
      statusCode: 409,
    });
  }
  const claimStateFilter =
    shipment.purchaseState === "OUTCOME_UNKNOWN"
      ? { purchaseState: "OUTCOME_UNKNOWN" as const }
      : { purchaseState: "IN_PROGRESS" as const, updatedAt: { lte: staleCutoff } };

  if (input.decision === "CONFIRMED_PURCHASE") {
    const externalShipmentId = input.externalShipmentId?.trim();
    if (!externalShipmentId || externalShipmentId.length > 100) {
      throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Informe um ID de envio válido." });
    }
    const accessToken = await getSellerMelhorEnvioAccessTokenWithScopes(shipment.sellerOrder.sellerId, ["orders-read"]);
    if (!accessToken)
      throw new ApplicationError({
        code: "CONFIGURATION_ERROR",
        message: "A loja precisa reconectar o Melhor Envio antes de conferir esta etiqueta.",
        statusCode: 409,
      });
    const details = await melhorEnvioProvider.getShipmentDetails(externalShipmentId, accessToken);
    const tags = readOrderTags(details);
    if (tags.length > 0 && !tags.includes(shipment.sellerOrder.order.orderNumber)) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O envio encontrado no Melhor Envio está associado a outro pedido.",
        statusCode: 409,
      });
    }

    const providerTagMatched = tags.includes(shipment.sellerOrder.order.orderNumber);
    await db.$transaction(async (tx) => {
      // Mesmo travamento/revalidação da compra normal: o pedido pode ter sido cancelado
      // enquanto a tentativa aguardava conferência.
      const sellerOrderStatus = await lockSellerOrderStatus(tx, shipment.sellerOrderId);
      const fulfillmentAllowed = canRunShipmentOperation(sellerOrderStatus, "PURCHASE");
      const reconciledMetadata = { reconciled: true, providerTagMatched };
      const updated = await tx.shipment.updateMany({
        where: {
          id: shipment.id,
          provider: "MELHOR_ENVIO",
          externalShipmentId: null,
          ...claimStateFilter,
        },
        data: fulfillmentAllowed
          ? {
              externalShipmentId,
              purchaseState: null,
              purchaseError: null,
              status: "READY_TO_SHIP",
              providerMetadata: reconciledMetadata as Prisma.InputJsonValue,
            }
          : {
              externalShipmentId,
              purchaseState: null,
              purchaseError: STALE_PURCHASE_MESSAGE,
              ...(sellerOrderStatus === "CANCELLED"
                ? {
                    status: "CANCELLED" as const,
                    providerMetadata: withLabelCancellationFlag(reconciledMetadata, "PURCHASED_AFTER_CANCELLATION"),
                  }
                : { providerMetadata: reconciledMetadata as Prisma.InputJsonValue }),
            },
      });
      if (updated.count !== 1)
        throw new ApplicationError({ code: "CONFLICT", message: "A tentativa já foi atualizada." });
      if (fulfillmentAllowed) {
        await syncFulfillmentStatuses(tx, shipment.sellerOrderId, "READY_TO_SHIP", input.actorUserId);
      }
      await tx.auditLog.create({
        data: {
          action: "SHIPMENT_PURCHASE_RECONCILED",
          entityType: "SHIPMENT",
          entityId: shipment.id,
          actorUserId: input.actorUserId,
          metadata: {
            decision: input.decision,
            externalShipmentId,
            orderNumber: shipment.sellerOrder.order.orderNumber,
            providerTagMatched,
            ...(fulfillmentAllowed ? {} : { staleSellerOrderStatus: sellerOrderStatus }),
          },
        },
      });
    });
    return;
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.shipment.updateMany({
      where: {
        id: shipment.id,
        provider: "MELHOR_ENVIO",
        externalShipmentId: null,
        ...claimStateFilter,
      },
      data: { purchaseState: null, purchaseError: null },
    });
    if (updated.count !== 1)
      throw new ApplicationError({ code: "CONFLICT", message: "A tentativa já foi atualizada." });
    await tx.auditLog.create({
      data: {
        action: "SHIPMENT_PURCHASE_RECONCILED",
        entityType: "SHIPMENT",
        entityId: shipment.id,
        actorUserId: input.actorUserId,
        metadata: {
          decision: input.decision,
          orderNumber: shipment.sellerOrder.order.orderNumber,
          confirmation: "Admin confirmou que não existe compra para este pedido no Melhor Envio.",
        },
      },
    });
  });
}

function readOrderTags(details: Record<string, unknown>): string[] {
  const options = asRecord(details.options);
  const values = [details.tags, options.tags].find(Array.isArray);
  if (!Array.isArray(values)) return [];
  return values.flatMap((item) => {
    if (typeof item === "string") return [item];
    const value = asRecord(item).tag;
    return typeof value === "string" ? [value] : [];
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
