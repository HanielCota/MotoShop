/**
 * A PROCESSING NotificationDelivery is a lease held by the worker sending it.
 * After this window the worker is presumed dead (crash, timeout) and another
 * attempt may reclaim the row; the provider idempotency key prevents duplicates.
 */
export const NOTIFICATION_PROCESSING_LEASE_MS = 5 * 60 * 1000;

export function notificationLeaseCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - NOTIFICATION_PROCESSING_LEASE_MS);
}

/** Prisma filter for deliveries an admin may resend: FAILED, or PROCESSING past the lease. */
export function retryableNotificationDeliveryWhere(now: Date = new Date()) {
  return {
    OR: [
      { status: "FAILED" as const },
      { status: "PROCESSING" as const, updatedAt: { lte: notificationLeaseCutoff(now) } },
    ],
  };
}

export function isNotificationDeliveryRetryable(
  delivery: { status: string; updatedAt: Date },
  now: Date = new Date(),
): boolean {
  return (
    delivery.status === "FAILED" ||
    (delivery.status === "PROCESSING" && delivery.updatedAt.getTime() <= notificationLeaseCutoff(now).getTime())
  );
}
