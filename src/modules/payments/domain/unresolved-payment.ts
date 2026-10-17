/** How long a charge may stay unknown to the provider before it needs a human look (L-09). */
export const UNRESOLVED_PAYMENT_ALERT_MS = 6 * 60 * 60 * 1000;

/**
 * The scheduled recovery stops asking the provider about a payment after this age (A8). Pix expires
 * in 30 minutes and cards answer at once, so a week is far past any provider answer; older pending
 * payments were already flagged at 6 h and stay in the Admin list, and webhooks still update them.
 */
export const PAYMENT_RECOVERY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Grace period: the checkout may still be sending the charge of a very recent payment. */
export const PAYMENT_RECOVERY_MIN_AGE_MS = 2 * 60 * 1000;

/** Creation window of the payments the scheduled recovery asks the provider about. */
export function paymentRecoveryWindow(now: Date): { createdAfter: Date; createdBefore: Date } {
  return {
    createdAfter: new Date(now.getTime() - PAYMENT_RECOVERY_MAX_AGE_MS),
    createdBefore: new Date(now.getTime() - PAYMENT_RECOVERY_MIN_AGE_MS),
  };
}

/** A payment without provider id that the provider search still cannot find after the threshold. */
export function isLongUnresolvedPayment(payment: { externalId: string | null; createdAt: Date }, now: Date): boolean {
  return payment.externalId === null && now.getTime() - payment.createdAt.getTime() >= UNRESOLVED_PAYMENT_ALERT_MS;
}
