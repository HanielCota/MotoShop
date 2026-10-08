import "server-only";

import { db } from "@/lib/database";
import { logger } from "@/lib/logger";

import { decideUnsentCharge, type UnsentChargeDecision } from "../domain/payment-request-state";
import { applyPaymentOutcome } from "./apply-payment-outcome";

export type ReleaseUnsentPaymentResult = { decision: UnsentChargeDecision; released: boolean };

/**
 * Cancels a pending order whose charge provably never reached the provider (see the rule in
 * `payment-request-state.ts`). The decision is re-evaluated under the order row lock, which
 * the checkout also takes before marking the request as SENT, so both cannot race.
 * Idempotent: a second call finds the order already out of PENDING_PAYMENT and does nothing.
 */
export async function releaseUnsentPayment(
  paymentId: string,
  now: Date = new Date(),
): Promise<ReleaseUnsentPaymentResult> {
  return db.$transaction(async (tx) => {
    const locked = await tx.payment.findUnique({ where: { id: paymentId }, select: { orderId: true } });
    if (!locked) return { decision: "ASK_PROVIDER" as const, released: false };
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${locked.orderId} FOR UPDATE`;
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        order: { include: { sellerOrders: { include: { items: true } } } },
        transactions: { where: { type: "AUTHORIZATION" }, orderBy: { createdAt: "asc" }, take: 1 },
      },
    });
    if (payment.order.status !== "PENDING_PAYMENT") return { decision: "ASK_PROVIDER" as const, released: false };
    const transaction = payment.transactions[0];
    const decision = decideUnsentCharge({
      paymentExternalId: payment.externalId,
      paymentStatus: payment.status,
      transaction,
      now,
    });
    if (decision !== "RELEASE_NEVER_SENT" && decision !== "RELEASE_REJECTED") return { decision, released: false };

    const previous =
      transaction?.providerMetadata && typeof transaction.providerMetadata === "object"
        ? (transaction.providerMetadata as Record<string, unknown>)
        : {};
    await applyPaymentOutcome(tx, {
      order: payment.order,
      paymentId: payment.id,
      transactionId: transaction?.id,
      result: {
        status: decision === "RELEASE_REJECTED" ? "FAILED" : "CANCELLED",
        providerMetadata: { ...previous, releasedAt: now.toISOString() },
        failedAt: now,
      },
      releaseReason:
        decision === "RELEASE_REJECTED"
          ? "Payment request rejected by provider (recovered)"
          : "Payment request never sent to provider",
      now,
    });
    logger.warn({ event: "payment.unsent_charge_released", orderId: payment.order.id, paymentId, decision });
    return { decision, released: true };
  });
}
