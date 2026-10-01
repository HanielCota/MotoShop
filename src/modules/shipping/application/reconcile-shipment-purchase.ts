import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { melhorEnvioProvider } from "@/lib/shipping/melhor-envio-provider";
import { ApplicationError } from "@/shared/errors/application-error";

type ReconciliationInput = {
  shipmentId: string;
  actorUserId: string;
  confirmedOrderNumber: string;
  decision: "CONFIRMED_PURCHASE" | "CONFIRMED_NOT_PURCHASED";
  externalShipmentId?: string;
};

export async function reconcileShipmentPurchase(input: ReconciliationInput): Promise<void> {
  const shipment = await db.shipment.findUnique({
    where: { id: input.shipmentId },
    include: { sellerOrder: { select: { orderId: true, order: { select: { orderNumber: true } } } } },
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

  if (input.decision === "CONFIRMED_PURCHASE") {
    const externalShipmentId = input.externalShipmentId?.trim();
    if (!externalShipmentId || externalShipmentId.length > 100) {
      throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Informe um ID de envio válido." });
    }
    const details = await melhorEnvioProvider.getShipmentDetails(externalShipmentId);
    const tags = readOrderTags(details);
    if (tags.length > 0 && !tags.includes(shipment.sellerOrder.order.orderNumber)) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O envio encontrado no Melhor Envio está associado a outro pedido.",
        statusCode: 409,
      });
    }

    await db.$transaction(async (tx) => {
      const updated = await tx.shipment.updateMany({
        where: {
          id: shipment.id,
          provider: "MELHOR_ENVIO",
          externalShipmentId: null,
          purchaseState: { in: ["IN_PROGRESS", "OUTCOME_UNKNOWN"] },
        },
        data: {
          externalShipmentId,
          purchaseState: null,
          purchaseError: null,
          status: "READY_TO_SHIP",
          providerMetadata: details as Prisma.InputJsonValue,
        },
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
            externalShipmentId,
            orderNumber: shipment.sellerOrder.order.orderNumber,
            providerTagMatched: tags.includes(shipment.sellerOrder.order.orderNumber),
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
        purchaseState: { in: ["IN_PROGRESS", "OUTCOME_UNKNOWN"] },
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
