import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { SellerOrderStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { melhorEnvioProvider } from "@/lib/shipping/melhor-envio-provider";
import { ApplicationError } from "@/shared/errors/application-error";
import { getSellerMelhorEnvioAccessTokenWithScopes } from "@/modules/shipping/infrastructure/melhor-envio-oauth";
import { canRunShipmentOperation } from "@/modules/orders/domain/fulfillment-status";
import { syncFulfillmentStatuses } from "@/modules/orders/application/sync-fulfillment-status";

import { withoutPurchaseCart } from "@/modules/shipping/domain/purchase-cart";

import { STALE_PURCHASE_MESSAGE, lockSellerOrderStatus, withLabelCancellationFlag } from "./shipment-operation-guard";

type ReconciliationInput = {
  shipmentId: string;
  actorUserId: string;
  confirmedOrderNumber: string;
  decision: "CONFIRMED_PURCHASE" | "CONFIRMED_NOT_PURCHASED";
  externalShipmentId?: string;
};

type ShipmentAwaitingReconciliation = Awaited<ReturnType<typeof findShipmentAwaitingReconciliation>>;
type PurchaseClaimStateFilter = ReturnType<typeof buildPurchaseClaimStateFilter>;

const purchaseClaimTimeoutMs = 5 * 60 * 1000;

export async function reconcileShipmentPurchase(input: ReconciliationInput): Promise<void> {
  const shipment = await findShipmentAwaitingReconciliation(input);
  const claimStateFilter = buildPurchaseClaimStateFilter(shipment);

  if (input.decision === "CONFIRMED_PURCHASE") {
    await confirmReconciledPurchase(input, shipment, claimStateFilter);
    return;
  }

  await releaseUnpurchasedShipment(input, shipment, claimStateFilter);
}

async function findShipmentAwaitingReconciliation(input: ReconciliationInput) {
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

  return shipment;
}

/** Uma tentativa `IN_PROGRESS` só pode ser reconciliada depois do tempo limite da chamada de compra. */
function buildPurchaseClaimStateFilter(shipment: { purchaseState: string | null; updatedAt: Date }) {
  const staleCutoff = new Date(Date.now() - purchaseClaimTimeoutMs);
  if (shipment.purchaseState === "IN_PROGRESS" && shipment.updatedAt > staleCutoff) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A chamada de compra ainda pode estar em andamento. Aguarde cinco minutos antes de reconciliar.",
      statusCode: 409,
    });
  }

  return shipment.purchaseState === "OUTCOME_UNKNOWN"
    ? { purchaseState: "OUTCOME_UNKNOWN" as const }
    : { purchaseState: "IN_PROGRESS" as const, updatedAt: { lte: staleCutoff } };
}

async function confirmReconciledPurchase(
  input: ReconciliationInput,
  shipment: ShipmentAwaitingReconciliation,
  claimStateFilter: PurchaseClaimStateFilter,
) {
  const orderNumber = shipment.sellerOrder.order.orderNumber;
  const externalShipmentId = requireExternalShipmentId(input.externalShipmentId);
  const providerTagMatched = await matchProviderShipmentTags(
    shipment.sellerOrder.sellerId,
    externalShipmentId,
    orderNumber,
  );

  await db.$transaction(async (tx) => {
    // Mesmo travamento/revalidação da compra normal: o pedido pode ter sido cancelado
    // enquanto a tentativa aguardava conferência.
    const sellerOrderStatus = await lockSellerOrderStatus(tx, shipment.sellerOrderId);
    const fulfillmentAllowed = canRunShipmentOperation(sellerOrderStatus, "PURCHASE");
    // Preserva o histórico (ex.: etiquetas anteriores) e encerra o item de carrinho pendente.
    const reconciledMetadata = {
      ...withoutPurchaseCart(shipment.providerMetadata),
      reconciled: true,
      providerTagMatched,
    };
    const updated = await tx.shipment.updateMany({
      where: buildReconciliationWhere(shipment.id, claimStateFilter),
      data: buildReconciledPurchaseData(externalShipmentId, sellerOrderStatus, fulfillmentAllowed, reconciledMetadata),
    });
    assertSingleShipmentUpdated(updated.count);
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
          orderNumber,
          providerTagMatched,
          ...(fulfillmentAllowed ? {} : { staleSellerOrderStatus: sellerOrderStatus }),
        },
      },
    });
  });
}

function requireExternalShipmentId(value: string | undefined): string {
  const externalShipmentId = value?.trim();
  if (!externalShipmentId || externalShipmentId.length > 100) {
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Informe um ID de envio válido." });
  }

  return externalShipmentId;
}

/** Confere no provedor que o envio informado não pertence a outro pedido. */
async function matchProviderShipmentTags(
  sellerId: string,
  externalShipmentId: string,
  orderNumber: string,
): Promise<boolean> {
  const accessToken = await getSellerMelhorEnvioAccessTokenWithScopes(sellerId, ["orders-read"]);
  if (!accessToken)
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "A loja precisa reconectar o Melhor Envio antes de conferir esta etiqueta.",
      statusCode: 409,
    });
  const details = await melhorEnvioProvider.getShipmentDetails(externalShipmentId, accessToken);
  const tags = readOrderTags(details);
  if (tags.length > 0 && !tags.includes(orderNumber)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O envio encontrado no Melhor Envio está associado a outro pedido.",
      statusCode: 409,
    });
  }

  return tags.includes(orderNumber);
}

function buildReconciledPurchaseData(
  externalShipmentId: string,
  sellerOrderStatus: SellerOrderStatus,
  fulfillmentAllowed: boolean,
  reconciledMetadata: Record<string, unknown>,
): Prisma.ShipmentUpdateManyMutationInput {
  if (fulfillmentAllowed) {
    return {
      externalShipmentId,
      purchaseState: null,
      purchaseError: null,
      status: "READY_TO_SHIP",
      providerMetadata: reconciledMetadata as Prisma.InputJsonValue,
    };
  }

  return {
    externalShipmentId,
    purchaseState: null,
    purchaseError: STALE_PURCHASE_MESSAGE,
    ...(sellerOrderStatus === "CANCELLED"
      ? {
          status: "CANCELLED" as const,
          providerMetadata: withLabelCancellationFlag(reconciledMetadata, "PURCHASED_AFTER_CANCELLATION"),
        }
      : { providerMetadata: reconciledMetadata as Prisma.InputJsonValue }),
  };
}

async function releaseUnpurchasedShipment(
  input: ReconciliationInput,
  shipment: ShipmentAwaitingReconciliation,
  claimStateFilter: PurchaseClaimStateFilter,
) {
  await db.$transaction(async (tx) => {
    const updated = await tx.shipment.updateMany({
      where: buildReconciliationWhere(shipment.id, claimStateFilter),
      data: { purchaseState: null, purchaseError: null },
    });
    assertSingleShipmentUpdated(updated.count);
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

function buildReconciliationWhere(shipmentId: string, claimStateFilter: PurchaseClaimStateFilter) {
  return {
    id: shipmentId,
    provider: "MELHOR_ENVIO" as const,
    externalShipmentId: null,
    ...claimStateFilter,
  };
}

function assertSingleShipmentUpdated(count: number) {
  if (count !== 1) throw new ApplicationError({ code: "CONFLICT", message: "A tentativa já foi atualizada." });
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
