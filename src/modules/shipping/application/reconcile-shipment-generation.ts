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

type GenerationReconciliationInput = {
  shipmentId: string;
  actorUserId: string;
  confirmedOrderNumber: string;
  decision: "CONFIRMED_GENERATED" | "CONFIRMED_NOT_GENERATED";
};

type GenerationAwaitingReconciliation = Awaited<ReturnType<typeof findGenerationAwaitingReconciliation>>;

type GenerationReconciliationUpdate = {
  data: Prisma.ShipmentUpdateManyMutationInput;
  syncStatus: ShipmentStatus | null;
  staleSellerOrderStatus: string | null;
};

export async function reconcileShipmentGeneration(input: GenerationReconciliationInput): Promise<void> {
  const shipment = await findGenerationAwaitingReconciliation(input);
  const now = new Date();
  const staleCutoff = assertGenerationClaimExpired(shipment, now);
  if (input.decision === "CONFIRMED_GENERATED") {
    await assertGeneratedShipmentReadable(shipment.sellerOrder.sellerId, shipment.externalShipmentId);
  }

  await db.$transaction(async (tx) => {
    const { data, syncStatus, staleSellerOrderStatus } =
      input.decision === "CONFIRMED_GENERATED"
        ? await lockAndBuildConfirmedGenerationUpdate(tx, shipment, now)
        : releasedGenerationUpdate();
    const updated = await tx.shipment.updateMany({
      where: buildGenerationReconciliationWhere(shipment, staleCutoff),
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

async function findGenerationAwaitingReconciliation(input: GenerationReconciliationInput) {
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

  return { ...shipment, externalShipmentId: shipment.externalShipmentId, generationState: shipment.generationState };
}

/** Uma geração `IN_PROGRESS` só pode ser reconciliada depois do tempo limite da chamada. */
function assertGenerationClaimExpired(shipment: { generationState: string; updatedAt: Date }, now: Date): Date {
  const staleCutoff = new Date(now.getTime() - generationClaimTimeoutMs);
  if (shipment.generationState === "IN_PROGRESS" && shipment.updatedAt > staleCutoff) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A chamada ainda pode estar em andamento. Aguarde cinco minutos antes de reconciliar.",
      statusCode: 409,
    });
  }

  return staleCutoff;
}

async function assertGeneratedShipmentReadable(sellerId: string, externalShipmentId: string): Promise<void> {
  const accessToken = await getSellerMelhorEnvioAccessTokenWithScopes(sellerId, ["orders-read"]);
  if (!accessToken) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "A loja precisa reconectar o Melhor Envio antes de conferir esta etiqueta.",
      statusCode: 409,
    });
  }
  await melhorEnvioProvider.getShipmentDetails(externalShipmentId, accessToken);
}

function releasedGenerationUpdate(): GenerationReconciliationUpdate {
  return {
    data: { generationState: null, generatedAt: null, generationError: null },
    syncStatus: null,
    staleSellerOrderStatus: null,
  };
}

/** Mesmo travamento/revalidação da geração normal antes de avançar o envio. */
async function lockAndBuildConfirmedGenerationUpdate(
  tx: Prisma.TransactionClient,
  shipment: GenerationAwaitingReconciliation,
  now: Date,
): Promise<GenerationReconciliationUpdate> {
  const sellerOrderStatus = await lockSellerOrderStatus(tx, shipment.sellerOrderId);
  await tx.$queryRaw`SELECT id FROM "shipments" WHERE id = ${shipment.id} FOR UPDATE`;
  const current = await tx.shipment.findUnique({
    where: { id: shipment.id },
    select: { status: true, providerMetadata: true },
  });
  if (!current) throw new ApplicationError({ code: "NOT_FOUND", message: "Geração de etiqueta não encontrada." });

  return confirmedGenerationUpdate(sellerOrderStatus, current, now);
}

function buildGenerationReconciliationWhere(
  shipment: GenerationAwaitingReconciliation,
  staleCutoff: Date,
): Prisma.ShipmentWhereInput {
  return {
    id: shipment.id,
    provider: "MELHOR_ENVIO",
    externalShipmentId: shipment.externalShipmentId,
    ...(shipment.generationState === "OUTCOME_UNKNOWN"
      ? { generationState: "OUTCOME_UNKNOWN" }
      : { generationState: "IN_PROGRESS", updatedAt: { lte: staleCutoff } }),
  };
}

function confirmedGenerationUpdate(
  sellerOrderStatus: Awaited<ReturnType<typeof lockSellerOrderStatus>>,
  current: { status: ShipmentStatus; providerMetadata: Parameters<typeof readProviderMetadata>[0] },
  now: Date,
): GenerationReconciliationUpdate {
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
