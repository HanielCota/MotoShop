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
  const { result, order } = input;
  const outcome = classifyPaymentStatusForPendingOrder(result.status);
  const terminal = outcome !== "PENDING_PAYMENT";
  const metadata = result.providerMetadata as Prisma.InputJsonValue;

  if (result.status === "REFUNDED") {
    logger.warn({
      event: "payment.refunded_before_settlement",
      orderId: order.id,
      ...(result.externalId ? { externalId: result.externalId } : {}),
      statusDetail:
        typeof result.providerMetadata.status_detail === "string" ? result.providerMetadata.status_detail : undefined,
    });
  }

  await tx.payment.update({
    where: { id: input.paymentId },
    data: {
      ...(result.externalId ? { externalId: result.externalId } : {}),
      status: result.status,
      providerMetadata: metadata,
      authorizedAt: result.authorizedAt ?? null,
      paidAt: result.paidAt ?? null,
      failedAt: result.failedAt ?? (outcome === "CANCELLED" ? now : null),
    },
  });

  if (input.transactionId) {
    await tx.paymentTransaction.update({
      where: { id: input.transactionId },
      data: {
        ...(result.externalId ? { externalId: result.externalId } : {}),
        // A refunded/charged-back payment was captured before being returned: the
        // authorization itself succeeded; Payment.status (REFUNDED) carries the reversal.
        status:
          outcome === "PAID" || result.status === "REFUNDED"
            ? "SUCCEEDED"
            : outcome === "CANCELLED"
              ? "FAILED"
              : "PENDING",
        providerMetadata: metadata,
        processedAt: terminal ? (result.paidAt ?? result.failedAt ?? now) : null,
      },
    });
  }

  if (outcome === "PAID") await commitOrderReservations(tx, order.sellerOrders, order.id);
  if (outcome === "CANCELLED") {
    await releaseOrderReservations(tx, order.sellerOrders, order.id, input.releaseReason);
    await tx.couponRedemption.deleteMany({ where: { orderId: order.id } });
  }
  if (terminal) {
    await tx.order.update({ where: { id: order.id }, data: { status: outcome } });
    await tx.sellerOrder.updateMany({ where: { orderId: order.id }, data: { status: outcome } });
  }

  if (terminal && result.externalId) {
    const eventStatus = result.status === "APPROVED" ? "APPROVED" : result.status === "FAILED" ? "FAILED" : "CANCELLED";
    await recordOutboxEvent(tx, {
      eventKey: `order-payment:${order.id}:${eventStatus}`,
      eventName: paymentStatusChangedEventName,
      aggregateType: "ORDER",
      aggregateId: order.id,
      payload: { orderNumber: order.orderNumber, status: eventStatus, externalId: result.externalId },
    });
  }

  return outcome;
}
