import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import {
  commitOrderReservations,
  releaseOrderReservations,
  type InventoryTransaction,
  type ReservedSellerOrder,
} from "@/modules/inventory/application/settle-order-inventory";
import { recordOutboxEvent } from "@/modules/outbox/application/record-outbox-event";
import { paymentStatusChangedEventName } from "@/modules/outbox/domain/outbox-events";
import type { PaymentProviderStatus } from "@/shared/payment/payment-provider";

export type PendingOrderPaymentOutcome = "PAID" | "CANCELLED" | "PENDING_PAYMENT";

/**
 * What a provider status means for an order that is still PENDING_PAYMENT.
 * REFUNDED covers both a refund and a full chargeback (`charged_back`) reported
 * before the approval was settled locally: the money is gone, so the order ends.
 * PARTIALLY_REFUNDED is NOT classified here; callers must route it to manual review.
 */
export function classifyPaymentStatusForPendingOrder(status: PaymentProviderStatus): PendingOrderPaymentOutcome {
  if (status === "APPROVED") return "PAID";
  if (status === "FAILED" || status === "CANCELLED" || status === "REFUNDED") return "CANCELLED";
  return "PENDING_PAYMENT";
}

export type ApplyPaymentOutcomeInput = {
  /** Must already be locked (`SELECT ... FOR UPDATE`) and verified as PENDING_PAYMENT by the caller. */
  order: { id: string; orderNumber: string; sellerOrders: ReservedSellerOrder[] };
  paymentId: string;
  transactionId?: string | undefined;
  result: {
    status: PaymentProviderStatus;
    externalId?: string | undefined;
    providerMetadata: Record<string, unknown>;
    authorizedAt?: Date | undefined;
    paidAt?: Date | undefined;
    failedAt?: Date | undefined;
  };
  releaseReason: string;
  now?: Date;
};

/**
 * Single place for the local effects of a payment answer on a pending order:
 * payment + authorization transaction status, stock commit/release, coupon redemption
 * removal on failure, order/seller-order status and the payment-status outbox event.
 */
export async function applyPaymentOutcome(
  tx: InventoryTransaction,
  input: ApplyPaymentOutcomeInput,
): Promise<PendingOrderPaymentOutcome> {
  const now = input.now ?? new Date();
  const outcome = classifyPaymentStatusForPendingOrder(input.result.status);

  if (input.result.status === "REFUNDED") logRefundBeforeSettlement(input.order.id, input.result);
  await updatePayment(tx, input, outcome, now);
  await updateAuthorizationTransaction(tx, input, outcome, now);
  await settleOrderReservations(tx, input, outcome);
  if (outcome === "PENDING_PAYMENT") return outcome;

  await updateOrderStatus(tx, input.order.id, outcome);
  await recordPaymentStatusChange(tx, input.order, input.result);
  return outcome;
}

type PaymentOutcomeResult = ApplyPaymentOutcomeInput["result"];

type TerminalPaymentOutcome = Exclude<PendingOrderPaymentOutcome, "PENDING_PAYMENT">;

function logRefundBeforeSettlement(orderId: string, result: PaymentOutcomeResult): void {
  logger.warn({
    event: "payment.refunded_before_settlement",
    orderId,
    ...(result.externalId ? { externalId: result.externalId } : {}),
    statusDetail:
      typeof result.providerMetadata.status_detail === "string" ? result.providerMetadata.status_detail : undefined,
  });
}

async function updatePayment(
  tx: InventoryTransaction,
  input: ApplyPaymentOutcomeInput,
  outcome: PendingOrderPaymentOutcome,
  now: Date,
): Promise<void> {
  const { result } = input;
  await tx.payment.update({
    where: { id: input.paymentId },
    data: {
      ...(result.externalId ? { externalId: result.externalId } : {}),
      status: result.status,
      providerMetadata: result.providerMetadata as Prisma.InputJsonValue,
      authorizedAt: result.authorizedAt ?? null,
      paidAt: result.paidAt ?? null,
      failedAt: result.failedAt ?? (outcome === "CANCELLED" ? now : null),
    },
  });
}

async function updateAuthorizationTransaction(
  tx: InventoryTransaction,
  input: ApplyPaymentOutcomeInput,
  outcome: PendingOrderPaymentOutcome,
  now: Date,
): Promise<void> {
  if (!input.transactionId) return;

  const { result } = input;
  const terminal = outcome !== "PENDING_PAYMENT";
  await tx.paymentTransaction.update({
    where: { id: input.transactionId },
    data: {
      ...(result.externalId ? { externalId: result.externalId } : {}),
      status: authorizationTransactionStatus(outcome, result.status),
      providerMetadata: result.providerMetadata as Prisma.InputJsonValue,
      processedAt: terminal ? (result.paidAt ?? result.failedAt ?? now) : null,
    },
  });
}

function authorizationTransactionStatus(
  outcome: PendingOrderPaymentOutcome,
  providerStatus: PaymentProviderStatus,
): "SUCCEEDED" | "FAILED" | "PENDING" {
  // A refunded/charged-back payment was captured before being returned: the
  // authorization itself succeeded; Payment.status (REFUNDED) carries the reversal.
  if (outcome === "PAID" || providerStatus === "REFUNDED") return "SUCCEEDED";
  if (outcome === "CANCELLED") return "FAILED";
  return "PENDING";
}

async function settleOrderReservations(
  tx: InventoryTransaction,
  input: ApplyPaymentOutcomeInput,
  outcome: PendingOrderPaymentOutcome,
): Promise<void> {
  const { order } = input;
  if (outcome === "PAID") await commitOrderReservations(tx, order.sellerOrders, order.id);
  if (outcome !== "CANCELLED") return;

  await releaseOrderReservations(tx, order.sellerOrders, order.id, input.releaseReason);
  await tx.couponRedemption.deleteMany({ where: { orderId: order.id } });
}

async function updateOrderStatus(
  tx: InventoryTransaction,
  orderId: string,
  outcome: TerminalPaymentOutcome,
): Promise<void> {
  await tx.order.update({ where: { id: orderId }, data: { status: outcome } });
  await tx.sellerOrder.updateMany({ where: { orderId }, data: { status: outcome } });
}

async function recordPaymentStatusChange(
  tx: InventoryTransaction,
  order: ApplyPaymentOutcomeInput["order"],
  result: PaymentOutcomeResult,
): Promise<void> {
  if (!result.externalId) return;

  const eventStatus = paymentEventStatus(result.status);
  await recordOutboxEvent(tx, {
    eventKey: `order-payment:${order.id}:${eventStatus}`,
    eventName: paymentStatusChangedEventName,
    aggregateType: "ORDER",
    aggregateId: order.id,
    payload: { orderNumber: order.orderNumber, status: eventStatus, externalId: result.externalId },
  });
}

function paymentEventStatus(providerStatus: PaymentProviderStatus): "APPROVED" | "FAILED" | "CANCELLED" {
  if (providerStatus === "APPROVED") return "APPROVED";
  if (providerStatus === "FAILED") return "FAILED";
  return "CANCELLED";
}
