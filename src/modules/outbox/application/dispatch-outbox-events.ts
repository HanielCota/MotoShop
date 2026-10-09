import "server-only";

import { OutboxEventStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";
import { outboxEventSchemas } from "../domain/outbox-events";

const batchSize = 50;
const maximumAttempts = 12;
const claimLeaseMilliseconds = 5 * 60 * 1000;
const maximumRetryDelayMilliseconds = 60 * 60 * 1000;

export async function dispatchPendingOutboxEvents(now = new Date()) {
  const staleClaimCutoff = new Date(now.getTime() - claimLeaseMilliseconds);
  const candidates = await db.outboxEvent.findMany({
    where: {
      OR: [
        { status: OutboxEventStatus.PENDING, availableAt: { lte: now } },
        { status: OutboxEventStatus.PROCESSING, claimedAt: { lte: staleClaimCutoff } },
      ],
    },
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    take: batchSize,
  });

  let dispatched = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const claimedAt = new Date(now);
    const claim = await db.outboxEvent.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        ...(candidate.status === OutboxEventStatus.PROCESSING ? { claimedAt: candidate.claimedAt } : {}),
      },
      data: {
        status: OutboxEventStatus.PROCESSING,
        claimedAt,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (claim.count !== 1) {
      skipped++;
      continue;
    }

    const schema = outboxEventSchemas[candidate.eventName as keyof typeof outboxEventSchemas];
    const parsed = schema?.safeParse(candidate.payload);
    if (!schema || !parsed?.success) {
      await db.outboxEvent.updateMany({
        where: { id: candidate.id, status: OutboxEventStatus.PROCESSING, claimedAt },
        data: {
          status: OutboxEventStatus.FAILED,
          claimedAt: null,
          lastError: "Persisted outbox event has an unsupported name or invalid payload.",
        },
      });
      failed++;
      logger.error(
        { event: "outbox.dispatch_invalid_event", outboxEventId: candidate.id, eventName: candidate.eventName },
        "Outbox event cannot be dispatched",
      );
      continue;
    }

    try {
      await inngest.send({
        id: candidate.eventKey,
        name: candidate.eventName as keyof typeof outboxEventSchemas,
        data: parsed.data,
      });
      const completed = await db.outboxEvent.updateMany({
        where: { id: candidate.id, status: OutboxEventStatus.PROCESSING, claimedAt },
        data: { status: OutboxEventStatus.DISPATCHED, claimedAt: null, dispatchedAt: new Date(), lastError: null },
      });
      if (completed.count === 1) dispatched++;
      if (completed.count !== 1) skipped++;
    } catch (error) {
      const attempts = candidate.attempts + 1;
      const terminal = attempts >= maximumAttempts;
      const delay = Math.min(maximumRetryDelayMilliseconds, 30_000 * 2 ** Math.min(attempts - 1, 7));
      await db.outboxEvent.updateMany({
        where: { id: candidate.id, status: OutboxEventStatus.PROCESSING, claimedAt },
        data: {
          status: terminal ? OutboxEventStatus.FAILED : OutboxEventStatus.PENDING,
          claimedAt: null,
          availableAt: new Date(now.getTime() + delay),
          lastError: error instanceof Error ? error.name.slice(0, 100) : "UnknownError",
        },
      });
      failed++;
      logger.error(
        {
          event: terminal ? "outbox.dispatch_failed_terminally" : "outbox.dispatch_failed_retryable",
          outboxEventId: candidate.id,
          eventName: candidate.eventName,
          attempts,
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
        "Outbox event dispatch failed",
      );
    }
  }

  return { considered: candidates.length, dispatched, failed, skipped };
}
