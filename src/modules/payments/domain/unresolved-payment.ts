/** How long a charge may stay unknown to the provider before it needs a human look (L-09). */
export const UNRESOLVED_PAYMENT_ALERT_MS = 6 * 60 * 60 * 1000;

/** A payment without provider id that the provider search still cannot find after the threshold. */
export function isLongUnresolvedPayment(payment: { externalId: string | null; createdAt: Date }, now: Date): boolean {
  return payment.externalId === null && now.getTime() - payment.createdAt.getTime() >= UNRESOLVED_PAYMENT_ALERT_MS;
}
