import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import type { GetPaymentResult } from "@/shared/payment/payment-provider";
import { ApplicationError } from "@/shared/errors/application-error";
import { isMotoShopOrderNumber } from "@/modules/checkout/domain/order-number";
import { assertPaymentMatches } from "../domain/payment-match";
import {
  detectUnexplainedReversal,
  unexplainedReversalMessages,
  type UnexplainedReversalKind,
} from "../domain/payment-reversal";
import { applyPaymentOutcome } from "./apply-payment-outcome";

type ReconcilePaymentInput = {
  externalId: string;
  result: GetPaymentResult;
  webhookEventId?: string;
  expectedPaymentId?: string;
};

type ReconciledPaymentStatus = GetPaymentResult["status"];

type LockedPayment = Awaited<ReturnType<typeof lockAndLoadPayment>>;

const lateApprovalReviewMessage =
  "O provedor informou pagamento aprovado após o pedido sair de PENDING_PAYMENT. Revisão financeira manual necessária.";

const partialRefundBeforeSettlementMessage =
  "O provedor informou reembolso parcial de um pedido ainda aguardando pagamento. Revisão financeira manual necessária.";

export async function reconcileMercadoPagoPayment(
  input: ReconcilePaymentInput,
): Promise<{ orderNumber: string; status: ReconciledPaymentStatus }> {
  const externalReference = readExternalReference(input.result.providerMetadata);
  // The Mercado Pago account may also receive payments from other integrations. A payment
  // whose external_reference is not a Moto Shop order number will never match an order:
  // acknowledge it instead of letting NOT_FOUND retries end as FAILED in the monitor.
  const foreignWebhookEventId = await findForeignPaymentWebhookEventId(input, externalReference);
  if (foreignWebhookEventId) {
    await acknowledgeForeignPayment(input.externalId, foreignWebhookEventId);
    return { orderNumber: externalReference ?? "", status: input.result.status };
  }

  const payment = await findPaymentToReconcile(input, externalReference);
  const persistedStatus = await db.$transaction(async (tx) => {
    const freshPayment = await lockAndLoadPayment(tx, payment.order.id, payment.id);
    assertPaymentMatches(freshPayment, input.result);
    assertSameCharge(freshPayment, input, externalReference);

    return reconcileLockedPayment(tx, freshPayment, input);
  });

  return { orderNumber: payment.order.orderNumber, status: persistedStatus };
}

async function findForeignPaymentWebhookEventId(
  input: ReconcilePaymentInput,
  externalReference: string | undefined,
): Promise<string | undefined> {
  if (!input.webhookEventId) return undefined;
  if (externalReference && isMotoShopOrderNumber(externalReference)) return undefined;

  const known = await db.payment.findFirst({
    where: { provider: "MERCADO_PAGO", externalId: input.externalId },
    select: { id: true },
  });
  return known ? undefined : input.webhookEventId;
}

async function acknowledgeForeignPayment(externalId: string, webhookEventId: string): Promise<void> {
  logger.info({
    event: "payment.webhook.foreign_reference_ignored",
    externalId,
    webhookEventId,
  });
  await db.webhookEvent.update({
    where: { id: webhookEventId },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      error: "Ignorado: a cobrança não pertence a um pedido do Moto Shop.",
    },
  });
}

async function findPaymentToReconcile(input: ReconcilePaymentInput, externalReference: string | undefined) {
  const payment = await db.payment.findFirst({
    where: {
      provider: "MERCADO_PAGO",
      ...(input.expectedPaymentId ? { id: input.expectedPaymentId } : {}),
      OR: [
        { externalId: input.externalId },
        ...(externalReference ? [{ order: { orderNumber: externalReference } }] : []),
      ],
    },
    include: {
      order: { include: { sellerOrders: { include: { items: true } } } },
      transactions: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!payment) {
    throw new ApplicationError({
      code: "NOT_FOUND",
      message: `Pagamento Mercado Pago ${input.externalId} ainda não está associado a um pedido.`,
      statusCode: 404,
    });
  }
  return payment;
}

async function lockAndLoadPayment(tx: Prisma.TransactionClient, orderId: string, paymentId: string) {
  await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;
  return tx.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { order: { include: { sellerOrders: { include: { items: true } } } }, transactions: true },
  });
}

function assertSameCharge(
  freshPayment: LockedPayment,
  input: ReconcilePaymentInput,
  externalReference: string | undefined,
): void {
  if (
    input.result.externalId !== input.externalId ||
    (freshPayment.externalId && freshPayment.externalId !== input.externalId) ||
    (externalReference && externalReference !== freshPayment.order.orderNumber)
  ) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A cobrança não corresponde ao pagamento deste pedido.",
    });
  }
}

async function reconcileLockedPayment(
  tx: Prisma.TransactionClient,
  freshPayment: LockedPayment,
  input: ReconcilePaymentInput,
): Promise<ReconciledPaymentStatus> {
  // Late/duplicate provider events must never regress fulfilled or cancelled orders.
  if (freshPayment.order.status !== "PENDING_PAYMENT") return reconcileSettledOrder(tx, freshPayment, input);

  if (input.result.status === "PARTIALLY_REFUNDED") {
    await flagPartialRefundBeforeSettlement(tx, freshPayment, input);
    return freshPayment.status;
  }

  await settlePendingOrder(tx, freshPayment, input);
  await markWebhookProcessed(tx, input.webhookEventId);
  return input.result.status;
}

async function reconcileSettledOrder(
  tx: Prisma.TransactionClient,
  freshPayment: LockedPayment,
  input: ReconcilePaymentInput,
): Promise<ReconciledPaymentStatus> {
  const lateApprovalRequiresReview = requiresLateApprovalReview(freshPayment.status, input.result.status);
  if (lateApprovalRequiresReview) await markWebhookFailed(tx, input.webhookEventId, lateApprovalReviewMessage);

  const reversal = detectUnexplainedReversal({
    paymentStatus: freshPayment.status,
    paymentAmountInCents: freshPayment.amountInCents,
    transactions: freshPayment.transactions,
    result: input.result,
  });
  if (reversal) {
    await flagUnexplainedReversal(tx, freshPayment, input, reversal);
    return freshPayment.status;
  }

  const isRefundUpdate = isRefundStatusUpdate(freshPayment.status, input.result.status);
  if (isRefundUpdate) await mirrorRefundStatus(tx, freshPayment.id, input.result);
  if (!lateApprovalRequiresReview) await markWebhookProcessed(tx, input.webhookEventId);
  return isRefundUpdate ? input.result.status : freshPayment.status;
}

function requiresLateApprovalReview(paymentStatus: string, providerStatus: ReconciledPaymentStatus): boolean {
  const paymentWasAlreadySettled = ["APPROVED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(paymentStatus);
  return providerStatus === "APPROVED" && !paymentWasAlreadySettled;
}

function isRefundStatusUpdate(paymentStatus: string, providerStatus: ReconciledPaymentStatus): boolean {
  return (
    ["APPROVED", "PARTIALLY_REFUNDED"].includes(paymentStatus) &&
    ["PARTIALLY_REFUNDED", "REFUNDED"].includes(providerStatus)
  );
}

async function flagUnexplainedReversal(
  tx: Prisma.TransactionClient,
  freshPayment: LockedPayment,
  input: ReconcilePaymentInput,
  reversal: UnexplainedReversalKind,
): Promise<void> {
  // Chargeback, mediation or a refund the Moto Shop did not issue: never mirror it
  // silently. Leave the payment untouched and surface it in the webhook monitor.
  logger.warn({
    event: "payment.unexplained_reversal",
    kind: reversal,
    orderId: freshPayment.order.id,
    paymentId: freshPayment.id,
    externalId: input.externalId,
    providerStatus: input.result.status,
  });
  await markWebhookFailed(tx, input.webhookEventId, unexplainedReversalMessages[reversal]);
}

async function mirrorRefundStatus(
  tx: Prisma.TransactionClient,
  paymentId: string,
  result: GetPaymentResult,
): Promise<void> {
  // Refund fulfillment is handled by the returns/cancellations workflows.
  // Still mirror the financial status without replaying stock or delivery changes.
  await tx.payment.update({
    where: { id: paymentId },
    data: {
      status: result.status,
      providerMetadata: result.providerMetadata as Prisma.InputJsonValue,
    },
  });
}

async function flagPartialRefundBeforeSettlement(
  tx: Prisma.TransactionClient,
  freshPayment: LockedPayment,
  input: ReconcilePaymentInput,
): Promise<void> {
  // Partially refunded before the approval was settled here: neither PAID nor CANCELLED
  // is safe automatically. Keep the order untouched and surface it for manual review.
  logger.warn({
    event: "payment.partially_refunded_before_settlement",
    orderId: freshPayment.order.id,
    externalId: input.externalId,
  });
  await markWebhookFailed(tx, input.webhookEventId, partialRefundBeforeSettlementMessage);
}

async function settlePendingOrder(
  tx: Prisma.TransactionClient,
  freshPayment: LockedPayment,
  input: ReconcilePaymentInput,
): Promise<void> {
  const transaction =
    freshPayment.transactions.find((candidate) => candidate.type === "AUTHORIZATION") ?? freshPayment.transactions[0];
  await applyPaymentOutcome(tx, {
    order: freshPayment.order,
    paymentId: freshPayment.id,
    transactionId: transaction?.id,
    result: { ...input.result, externalId: input.externalId },
    releaseReason:
      input.result.status === "REFUNDED" ? "Payment refunded or charged back" : "Payment failed or cancelled",
  });
}

async function markWebhookProcessed(tx: Prisma.TransactionClient, webhookEventId: string | undefined): Promise<void> {
  if (!webhookEventId) return;

  await tx.webhookEvent.update({
    where: { id: webhookEventId },
    data: { status: "PROCESSED", processedAt: new Date(), error: null },
  });
}

async function markWebhookFailed(
  tx: Prisma.TransactionClient,
  webhookEventId: string | undefined,
  error: string,
): Promise<void> {
  if (!webhookEventId) return;

  await tx.webhookEvent.update({
    where: { id: webhookEventId },
    data: { status: "FAILED", processedAt: null, error },
  });
}

function readExternalReference(metadata: Record<string, unknown>): string | undefined {
  const value = metadata.external_reference;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
