import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

import {
  LABEL_CANCELLATION_REQUIRED_FLAG,
  LABEL_CANCELLATION_REQUIRED_MESSAGE,
  hasLabelCancellationFlag,
  readProviderMetadata,
  withLabelCancellationFlag,
} from "./shipment-operation-guard";

/**
 * Chamado dentro da transação que aprova/conclui o cancelamento de um `SellerOrder`.
 *
 * Se uma etiqueta do Melhor Envio já foi comprada, marca o envio como cancelado e sinaliza
 * que a etiqueta precisa ser cancelada no provedor (para estorno) — o item passa a aparecer
 * em `/admin/shipping-recovery`. Nenhuma chamada externa acontece aqui (AGENTS.md §36).
 * Idempotente: um envio já sinalizado não é alterado novamente.
 */
export async function markShipmentLabelForCancellation(
  tx: Prisma.TransactionClient,
  sellerOrderId: string,
  actorUserId: string,
): Promise<{ labelCancellationRequired: boolean }> {
  await tx.$queryRaw`SELECT id FROM "shipments" WHERE "sellerOrderId" = ${sellerOrderId} FOR UPDATE`;
  const shipment = await tx.shipment.findUnique({
    where: { sellerOrderId },
    select: { id: true, provider: true, status: true, externalShipmentId: true, providerMetadata: true },
  });
  if (!shipment?.externalShipmentId || shipment.provider !== "MELHOR_ENVIO") {
    return { labelCancellationRequired: false };
  }
  if (hasLabelCancellationFlag(shipment.providerMetadata)) return { labelCancellationRequired: true };

  await tx.shipment.update({
    where: { id: shipment.id },
    data: {
      status: "CANCELLED",
      purchaseError: LABEL_CANCELLATION_REQUIRED_MESSAGE,
      providerMetadata: withLabelCancellationFlag(
        readProviderMetadata(shipment.providerMetadata),
        "SELLER_ORDER_CANCELLED",
      ),
    },
  });
  await tx.auditLog.create({
    data: {
      action: "SHIPMENT_LABEL_CANCELLATION_REQUIRED",
      entityType: "SHIPMENT",
      entityId: shipment.id,
      actorUserId,
      metadata: {
        sellerOrderId,
        externalShipmentId: shipment.externalShipmentId,
        previousStatus: shipment.status,
      },
    },
  });
  return { labelCancellationRequired: true };
}

/**
 * Admin confirma que a etiqueta sinalizada foi cancelada no Melhor Envio. Remove a pendência
 * da fila de conferência mantendo o id externo e o histórico para auditoria.
 */
export async function confirmShipmentLabelCancelled(input: {
  shipmentId: string;
  actorUserId: string;
  confirmedOrderNumber: string;
}): Promise<void> {
  const shipment = await db.shipment.findUnique({
    where: { id: input.shipmentId },
    select: {
      id: true,
      provider: true,
      externalShipmentId: true,
      providerMetadata: true,
      sellerOrder: { select: { order: { select: { orderNumber: true } } } },
    },
  });
  if (!shipment || shipment.provider !== "MELHOR_ENVIO" || !shipment.externalShipmentId) {
    throw new ApplicationError({ code: "NOT_FOUND", message: "Etiqueta não encontrada." });
  }
  if (!hasLabelCancellationFlag(shipment.providerMetadata)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Esta etiqueta não está aguardando cancelamento no Melhor Envio.",
      statusCode: 409,
    });
  }
  if (input.confirmedOrderNumber !== shipment.sellerOrder.order.orderNumber) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "Digite exatamente o número do pedido exibido para confirmar a conferência.",
    });
  }

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "shipments" WHERE id = ${shipment.id} FOR UPDATE`;
    const current = await tx.shipment.findUnique({
      where: { id: shipment.id },
      select: { externalShipmentId: true, providerMetadata: true },
    });
    if (current?.externalShipmentId !== shipment.externalShipmentId || !hasLabelCancellationFlag(current.providerMetadata)) {
      throw new ApplicationError({ code: "CONFLICT", message: "A etiqueta já foi atualizada.", statusCode: 409 });
    }
    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "CANCELLED",
        purchaseError: null,
        providerMetadata: {
          ...readProviderMetadata(current.providerMetadata),
          [LABEL_CANCELLATION_REQUIRED_FLAG]: false,
          labelCancelledConfirmedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "SHIPMENT_LABEL_CANCELLATION_CONFIRMED",
        entityType: "SHIPMENT",
        entityId: shipment.id,
        actorUserId: input.actorUserId,
        metadata: {
          externalShipmentId: shipment.externalShipmentId,
          orderNumber: shipment.sellerOrder.order.orderNumber,
        },
      },
    });
  });
}
