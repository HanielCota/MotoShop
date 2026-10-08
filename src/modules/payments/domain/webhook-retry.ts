export const STALE_WEBHOOK_PROCESSING_MS = 15 * 60 * 1000;

/**
 * WebhookEvent has no `updatedAt` column, so `receivedAt` is the staleness reference for
 * PROCESSING events. Reprocessing is safe because reconciliation locks the order and is
 * idempotent; the threshold only avoids racing a run that is genuinely still in flight.
 */
export function staleProcessingThreshold(now: Date = new Date()): Date {
  return new Date(now.getTime() - STALE_WEBHOOK_PROCESSING_MS);
}

/** Prisma filter for events an admin may re-enqueue: FAILED, or stuck in PROCESSING. */
export function retryableWebhookEventWhere(now: Date = new Date()) {
  return {
    OR: [
      { status: "FAILED" as const },
      { status: "PROCESSING" as const, receivedAt: { lt: staleProcessingThreshold(now) } },
    ],
  };
}

export function isWebhookEventRetryable(event: { status: string; receivedAt: Date }, now: Date = new Date()): boolean {
  return (
    event.status === "FAILED" ||
    (event.status === "PROCESSING" && event.receivedAt.getTime() < staleProcessingThreshold(now).getTime())
  );
}
