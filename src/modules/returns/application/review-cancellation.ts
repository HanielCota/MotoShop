import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { SellerOrderStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { cancelCommittedInventory } from "@/modules/inventory/application/settle-order-inventory";
import { syncOrderStatusFromSellerOrders } from "@/modules/orders/application/sync-order-status";
import { syncFulfillmentStatuses } from "@/modules/orders/application/sync-fulfillment-status";
import { markShipmentLabelForCancellation } from "@/modules/shipping/application/shipment-label-cancellation";
import { ApplicationError } from "@/shared/errors/application-error";

import { isShipmentPosted } from "../domain/cancellation-eligibility";
import { cancellationRefundBaseKey } from "../domain/refund-attempt";
import { refundAuditMetadata, refundPostSaleRequest, type RequestRefundOutcome } from "./refund-request";

export type ReviewCancellationInput = {
  cancellationRequestId: string;
  decision: "APPROVE" | "REJECT";
  note?: string;
  actorUserId: string;
};

export type ReviewCancellationResult = {
  outcome: "REFUNDED" | "ALREADY_REFUNDED" | "REJECTED";
  orderNumber: string;
};

const cancellationForReviewInclude = {
  sellerOrder: { include: { shipment: true } },
  order: { select: { orderNumber: true } },
} satisfies Prisma.CancellationRequestInclude;

type CancellationForReview = Prisma.CancellationRequestGetPayload<{ include: typeof cancellationForReviewInclude }>;

const cancellationForFinalizationInclude = {
  sellerOrder: { include: { items: true } },
} satisfies Prisma.CancellationRequestInclude;

type CancellationForFinalization = Prisma.CancellationRequestGetPayload<{
  include: typeof cancellationForFinalizationInclude;
}>;

export async function reviewCancellationRequest(input: ReviewCancellationInput): Promise<ReviewCancellationResult> {
  const request = await db.cancellationRequest.findUnique({
    where: { id: input.cancellationRequestId },
    include: cancellationForReviewInclude,
  });
  if (!request)
    throw new ApplicationError({ code: "NOT_FOUND", message: "Solicitação de cancelamento não encontrada." });
  const orderNumber = request.order.orderNumber;
  if (request.status === "REFUNDED") return { outcome: "ALREADY_REFUNDED", orderNumber };
  if (request.status === "REJECTED") {
    throw new ApplicationError({ code: "CONFLICT", message: "Esta solicitação já foi rejeitada.", statusCode: 409 });
  }

  if (input.decision === "REJECT") {
    await rejectCancellation({
      id: request.id,
      orderId: request.orderId,
      sellerOrderId: request.sellerOrderId,
      previousStatus: request.previousSellerOrderStatus,
      note: input.note,
      actorUserId: input.actorUserId,
    });
    return { outcome: "REJECTED", orderNumber };
  }

  await approveAndRefundCancellation(request, input);
  return { outcome: "REFUNDED", orderNumber };
}

async function approveAndRefundCancellation(
  request: CancellationForReview,
  input: ReviewCancellationInput,
): Promise<void> {
  assertApprovalStillPending(request.status);
  assertCancellable(request.sellerOrder.status, request.sellerOrder.shipment?.status);
  if (request.status === "REQUESTED") await approveCancellation(request, input);

  // Saída administrativa: uma solicitação APPROVED cujo reembolso falhou (recusa definitiva do
  // provedor) pode ser reprocessada com nova decisão APPROVE ("Continuar processamento"). Se todas
  // as tentativas anteriores estão FAILED, uma nova chave `:retry-<n>` é derivada; uma tentativa
  // PENDING/SUCCEEDED é sempre reutilizada para reconciliar, nunca para gerar um segundo reembolso.
  // Se o pagamento já foi totalmente reembolsado no provedor, a solicitação é concluída sem nova chamada.
  const refund = await refundCancellation(request);
  await finalizeRefundedCancellation(request, input.actorUserId, refund);
}

function assertApprovalStillPending(status: CancellationForReview["status"]): void {
  if (["REQUESTED", "APPROVED"].includes(status)) return;

  throw new ApplicationError({
    code: "CONFLICT",
    message: "Esta solicitação já está em processamento.",
    statusCode: 409,
  });
}

async function approveCancellation(request: CancellationForReview, input: ReviewCancellationInput): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${request.orderId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "seller_orders" WHERE id = ${request.sellerOrderId} FOR UPDATE`;
    await assertLockedSellerOrderCancellable(tx, request.sellerOrderId);
    await markCancellationApproved(tx, request.id, input.note);
    await tx.auditLog.create({
      data: {
        action: "CANCELLATION_APPROVED",
        entityType: "CANCELLATION_REQUEST",
        entityId: request.id,
        actorUserId: input.actorUserId,
        metadata: { previousStatus: request.status } as Prisma.InputJsonValue,
      },
    });
  });
}

async function assertLockedSellerOrderCancellable(tx: Prisma.TransactionClient, sellerOrderId: string): Promise<void> {
  // Relê com o pedido travado: o rastreio pode ter registrado a postagem desde a leitura acima.
  const locked = await tx.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    select: { status: true, shipment: { select: { status: true } } },
  });
  if (!locked) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido da loja não encontrado." });
  assertCancellable(locked.status, locked.shipment?.status);
}

async function markCancellationApproved(
  tx: Prisma.TransactionClient,
  cancellationRequestId: string,
  note: string | undefined,
): Promise<void> {
  const approved = await tx.cancellationRequest.updateMany({
    where: { id: cancellationRequestId, status: "REQUESTED" },
    data: { status: "APPROVED", ...(note !== undefined ? { adminNote: note } : {}) },
  });
  if (approved.count !== 1)
    throw new ApplicationError({ code: "CONFLICT", message: "Esta solicitação já foi decidida.", statusCode: 409 });
}

async function refundCancellation(request: CancellationForReview): Promise<RequestRefundOutcome | null> {
  if (request.amountInCents <= 0) return null;

  return refundPostSaleRequest({
    baseKey: cancellationRefundBaseKey(request.id),
    orderId: request.orderId,
    amountInCents: request.amountInCents,
    reason: `Cancelamento do seller order ${request.sellerOrderId}`,
  });
}

async function finalizeRefundedCancellation(
  request: CancellationForReview,
  actorUserId: string,
  refund: RequestRefundOutcome | null,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${request.orderId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "cancellation_requests" WHERE id = ${request.id} FOR UPDATE`;
    const current = await findApprovedOrRefundedCancellation(tx, request.id);
    if (current.status === "REFUNDED") return;

    await cancelSellerOrderForRefund(tx, current, actorUserId);
    await syncOrderStatusFromSellerOrders(tx, current.orderId, "CANCELLATION", actorUserId);
    await tx.auditLog.create({
      data: {
        action: "CANCELLATION_REFUNDED",
        entityType: "CANCELLATION_REQUEST",
        entityId: current.id,
        actorUserId,
        metadata: { amountInCents: current.amountInCents, ...refundAuditMetadata(refund) } as Prisma.InputJsonValue,
      },
    });
  });
}

async function findApprovedOrRefundedCancellation(
  tx: Prisma.TransactionClient,
  cancellationRequestId: string,
): Promise<CancellationForFinalization> {
  const current = await tx.cancellationRequest.findUnique({
    where: { id: cancellationRequestId },
    include: cancellationForFinalizationInclude,
  });
  if (current?.status === "REFUNDED") return current;
  if (!current || current.status !== "APPROVED") {
    throw new ApplicationError({ code: "CONFLICT", message: "O cancelamento já foi finalizado.", statusCode: 409 });
  }

  return current;
}

async function cancelSellerOrderForRefund(
  tx: Prisma.TransactionClient,
  current: CancellationForFinalization,
  actorUserId: string,
): Promise<void> {
  await cancelCommittedInventory(tx, [{ sellerId: current.sellerId, items: current.sellerOrder.items }], {
    referenceType: "CANCELLATION_REQUEST",
    referenceId: current.id,
    actorUserId,
  });
  await tx.sellerOrder.update({ where: { id: current.sellerOrderId }, data: { status: "CANCELLED" } });
  // A label already bought for this seller order is now useless; flag it for cancellation at the provider.
  await markShipmentLabelForCancellation(tx, current.sellerOrderId, actorUserId);
  await tx.cancellationRequest.update({ where: { id: current.id }, data: { status: "REFUNDED" } });
}

function assertCancellable(sellerOrderStatus: SellerOrderStatus, shipmentStatus: string | undefined) {
  if (sellerOrderStatus !== "CANCELLATION_REQUESTED") {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O status do pedido não permite este cancelamento.",
      statusCode: 409,
    });
  }
  // Pacote já saiu da loja: o caminho passa a ser devolução.
  if (isShipmentPosted(shipmentStatus)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O pedido já foi postado e deve seguir o fluxo de devolução.",
      statusCode: 409,
    });
  }
}

async function rejectCancellation(input: {
  id: string;
  orderId: string;
  sellerOrderId: string;
  previousStatus: SellerOrderStatus;
  note: string | undefined;
  actorUserId: string;
}) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${input.orderId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "cancellation_requests" WHERE id = ${input.id} FOR UPDATE`;
    const updated = await tx.cancellationRequest.updateMany({
      where: { id: input.id, status: "REQUESTED" },
      data: { status: "REJECTED", ...(input.note !== undefined ? { adminNote: input.note } : {}) },
    });
    if (updated.count !== 1)
      throw new ApplicationError({ code: "CONFLICT", message: "Esta solicitação já foi decidida.", statusCode: 409 });
    const restored = await tx.sellerOrder.updateMany({
      where: { id: input.sellerOrderId, status: "CANCELLATION_REQUESTED" },
      data: { status: input.previousStatus === "CANCELLATION_REQUESTED" ? "PROCESSING" : input.previousStatus },
    });
    if (restored.count !== 1) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O status do pedido mudou e a solicitação não pôde ser rejeitada.",
        statusCode: 409,
      });
    }

    // Durante a análise o rastreio pode ter avançado (ex.: etiqueta gerada ou pacote postado),
    // mas o status do pedido ficou congelado em CANCELLATION_REQUESTED. Ressincroniza a partir
    // do envio atual para não restaurar um status defasado.
    const shipment = await tx.shipment.findUnique({
      where: { sellerOrderId: input.sellerOrderId },
      select: { status: true },
    });
    await (shipment
      ? syncFulfillmentStatuses(tx, input.sellerOrderId, shipment.status, input.actorUserId)
      : syncOrderStatusFromSellerOrders(tx, input.orderId, "CANCELLATION", input.actorUserId));
    await tx.auditLog.create({
      data: {
        action: "CANCELLATION_REJECTED",
        entityType: "CANCELLATION_REQUEST",
        entityId: input.id,
        actorUserId: input.actorUserId,
        metadata: { note: input.note ?? null } as Prisma.InputJsonValue,
      },
    });
  });
}
