import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ShipmentStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { melhorEnvioProvider } from "@/lib/shipping/melhor-envio-provider";
import { canRunShipmentOperation, resolveShipmentStatus } from "@/modules/orders/domain/fulfillment-status";
import { syncFulfillmentStatuses } from "@/modules/orders/application/sync-fulfillment-status";
import { ApplicationError } from "@/shared/errors/application-error";
import { getSellerMelhorEnvioAccessTokenWithScopes } from "@/modules/shipping/infrastructure/melhor-envio-oauth";

import {
  STALE_GENERATION_MESSAGE,
  lockSellerOrderStatus,
  readProviderMetadata,
  withLabelCancellationFlag,
} from "./shipment-operation-guard";

const generationClaimTimeoutMs = 5 * 60 * 1000;

export async function reconcileShipmentGeneration(input: {
  shipmentId: string;
  actorUserId: string;
  confirmedOrderNumber: string;
  decision: "CONFIRMED_GENERATED" | "CONFIRMED_NOT_GENERATED";
}): Promise<void> {
  const shipment = await db.shipment.findUnique({
    where: { id: input.shipmentId },
    include: { sellerOrder: { select: { sellerId: true, order: { select: { orderNumber: true } } } } },
  });
  if (!shipment || shipment.provider !== "MELHOR_ENVIO" || !shipment.externalShipmentId) {
    throw new ApplicationError({ code: "NOT_FOUND", message: "Geração de etiqueta não encontrada." });
  }
  if (!shipment.generationState || shipment.generationState === "GENERATED") {
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

  const now = new Date();
  const staleCutoff = new Date(now.getTime() - generationClaimTimeoutMs);
  if (shipment.generationState === "IN_PROGRESS" && shipment.updatedAt > staleCutoff) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A chamada ainda pode estar em andamento. Aguarde cinco minutos antes de reconciliar.",
      statusCode: 409,
    });
  }

  if (input.decision === "CONFIRMED_GENERATED") {
    const accessToken = await getSellerMelhorEnvioAccessTokenWithScopes(shipment.sellerOrder.sellerId, ["orders-read"]);
    if (!accessToken) {
      throw new ApplicationError({
        code: "CONFIGURATION_ERROR",
        message: "A loja precisa reconectar o Melhor Envio antes de conferir esta etiqueta.",
        statusCode: 409,
      });
    }
    await melhorEnvioProvider.getShipmentDetails(shipment.externalShipmentId, accessToken);
  }

  await db.$transaction(async (tx) => {
    let data: Prisma.ShipmentUpdateManyMutationInput = {
      generationState: null,
      generatedAt: null,
      generationError: null,
    };
    let syncStatus: ShipmentStatus | null = null;
    let staleSellerOrderStatus: string | null = null;

    if (input.decision === "CONFIRMED_GENERATED") {
      // Mesmo travamento/revalidação da geração normal antes de avançar o envio.
      const sellerOrderStatus = await lockSellerOrderStatus(tx, shipment.sellerOrderId);
      await tx.$queryRaw`SELECT id FROM "shipments" WHERE id = ${shipment.id} FOR UPDATE`;
      const current = await tx.shipment.findUnique({
        where: { id: shipment.id },
        select: { status: true, providerMetadata: true },
      });
      if (!current) throw new ApplicationError({ code: "NOT_FOUND", message: "Geração de etiqueta não encontrada." });

      ({ data, syncStatus, staleSellerOrderStatus } = confirmedGenerationUpdate(sellerOrderStatus, current, now));
    }

    const updated = await tx.shipment.updateMany({
      where: {
        id: shipment.id,
        provider: "MELHOR_ENVIO",
        externalShipmentId: shipment.externalShipmentId,
        ...(shipment.generationState === "OUTCOME_UNKNOWN"
          ? { generationState: "OUTCOME_UNKNOWN" }
          : { generationState: "IN_PROGRESS", updatedAt: { lte: staleCutoff } }),
      },
      data,
    });
    if (updated.count !== 1)
      throw new ApplicationError({ code: "CONFLICT", message: "A tentativa já foi atualizada." });
    if (syncStatus) await syncFulfillmentStatuses(tx, shipment.sellerOrderId, syncStatus, input.actorUserId);
    await tx.auditLog.create({
      data: {
        action: "SHIPMENT_GENERATION_RECONCILED",
        entityType: "SHIPMENT",
        entityId: shipment.id,
        actorUserId: input.actorUserId,
        metadata: {
          decision: input.decision,
          orderNumber: shipment.sellerOrder.order.orderNumber,
          externalShipmentId: shipment.externalShipmentId,
          ...(staleSellerOrderStatus ? { staleSellerOrderStatus } : {}),
        },
      },
    });
  });
}

function confirmedGenerationUpdate(
  sellerOrderStatus: Awaited<ReturnType<typeof lockSellerOrderStatus>>,
  current: { status: ShipmentStatus; providerMetadata: Parameters<typeof readProviderMetadata>[0] },
  now: Date,
): {
  data: Prisma.ShipmentUpdateManyMutationInput;
  syncStatus: ShipmentStatus | null;
  staleSellerOrderStatus: string | null;
} {
  if (canRunShipmentOperation(sellerOrderStatus, "GENERATE")) {
    const status = resolveShipmentStatus(current.status, "READY_TO_SHIP");
    return {
      data: { generationState: "GENERATED", generatedAt: now, generationError: null, status },
      syncStatus: status,
      staleSellerOrderStatus: null,
    };
  }

  return {
    data: {
      generationState: "GENERATED",
      generatedAt: now,
      generationError: STALE_GENERATION_MESSAGE,
      ...(sellerOrderStatus === "CANCELLED"
        ? {
            status: "CANCELLED",
            providerMetadata: withLabelCancellationFlag(
              readProviderMetadata(current.providerMetadata),
              "GENERATED_AFTER_CANCELLATION",
            ),
          }
        : {}),
    },
    syncStatus: null,
    staleSellerOrderStatus: sellerOrderStatus,
  };
}
