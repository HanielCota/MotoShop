import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { SellerOrderStatus } from "@/generated/prisma/enums";
import { canRunShipmentOperation, type ShipmentOperation } from "@/modules/orders/domain/fulfillment-status";
import { ApplicationError } from "@/shared/errors/application-error";

export const STALE_PURCHASE_MESSAGE =
  "O pedido foi cancelado durante a compra da etiqueta. Cancele a etiqueta no Melhor Envio para solicitar o estorno.";
export const STALE_GENERATION_MESSAGE =
  "O pedido foi cancelado durante a geração da etiqueta. Cancele a etiqueta no Melhor Envio antes da postagem.";
export const LABEL_CANCELLATION_REQUIRED_MESSAGE =
  "O pedido foi cancelado com etiqueta já comprada. Cancele a etiqueta no Melhor Envio para solicitar o estorno.";

/** Chave em `Shipment.providerMetadata` que sinaliza etiqueta paga a cancelar manualmente no provedor. */
export const LABEL_CANCELLATION_REQUIRED_FLAG = "labelCancellationRequired";

/**
 * Trava pedido e pedido da loja (mesma ordem usada por cancelamento e devolução, evitando
 * deadlock) e devolve o status atual do pedido da loja.
 */
export async function lockSellerOrderStatus(
  tx: Prisma.TransactionClient,
  sellerOrderId: string,
): Promise<SellerOrderStatus> {
  const reference = await tx.sellerOrder.findUnique({ where: { id: sellerOrderId }, select: { orderId: true } });
  if (!reference) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido do lojista não encontrado." });
  await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${reference.orderId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "seller_orders" WHERE id = ${sellerOrderId} FOR UPDATE`;
  const locked = await tx.sellerOrder.findUnique({ where: { id: sellerOrderId }, select: { status: true } });
  if (!locked) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido do lojista não encontrado." });
  return locked.status;
}

const shipmentOperationBlockedMessages: Record<ShipmentOperation, string> = {
  PURCHASE: "Este pedido não está disponível para compra de etiqueta (aguardando pagamento ou cancelado).",
  GENERATE: "Este pedido não está disponível para geração de etiqueta (cancelado ou em análise de cancelamento).",
  TRACK: "Este pedido não está disponível para atualização de rastreio.",
};

export function assertShipmentOperationAllowed(status: SellerOrderStatus, operation: ShipmentOperation) {
  if (!canRunShipmentOperation(status, operation)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: shipmentOperationBlockedMessages[operation],
      statusCode: 409,
    });
  }
}

export function readProviderMetadata(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Mescla o metadado seguro do provedor com a sinalização de etiqueta a cancelar no provedor. */
export function withLabelCancellationFlag(
  providerMetadata: Record<string, unknown>,
  reason: string,
): Prisma.InputJsonValue {
  return {
    ...providerMetadata,
    [LABEL_CANCELLATION_REQUIRED_FLAG]: true,
    labelCancellationReason: reason,
    labelCancellationFlaggedAt: new Date().toISOString(),
  } as Prisma.InputJsonValue;
}

export function hasLabelCancellationFlag(value: Prisma.JsonValue | null | undefined): boolean {
  return readProviderMetadata(value)[LABEL_CANCELLATION_REQUIRED_FLAG] === true;
}
