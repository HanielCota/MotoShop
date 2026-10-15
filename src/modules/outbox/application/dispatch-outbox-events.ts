import "server-only";

import type { OutboxEvent } from "@/generated/prisma/client";
import { OutboxEventStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";
import { outboxEventSchemas } from "../domain/outbox-events";

const batchSize = 50;
const maximumAttempts = 12;
const claimLeaseMilliseconds = 5 * 60 * 1000;
const maximumRetryDelayMilliseconds = 60 * 60 * 1000;

type OutboxEventName = keyof typeof outboxEventSchemas;
type DispatchOutcome = "dispatched" | "failed" | "skipped";

export async function dispatchPendingOutboxEvents(now = new Date()) {
  const candidates = await findDispatchCandidates(now);
  const outcomes: DispatchOutcome[] = [];

  // Sequential on purpose: each claim must settle before the next candidate is processed.
  for (const candidate of candidates) {
    outcomes.push(await dispatchCandidate(candidate, now));
  }

  return {
    considered: candidates.length,
    dispatched: countOutcomes(outcomes, "dispatched"),
    failed: countOutcomes(outcomes, "failed"),
    skipped: countOutcomes(outcomes, "skipped"),
  };
}

/** Pending events that are due, plus processing events whose claim lease expired. */
function findDispatchCandidates(now: Date) {
  const staleClaimCutoff = new Date(now.getTime() - claimLeaseMilliseconds);
  return db.outboxEvent.findMany({
    where: {
      OR: [
        { status: OutboxEventStatus.PENDING, availableAt: { lte: now } },
        { status: OutboxEventStatus.PROCESSING, claimedAt: { lte: staleClaimCutoff } },
      ],
    },
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    take: batchSize,
  });
}

async function dispatchCandidate(candidate: OutboxEvent, now: Date): Promise<DispatchOutcome> {
  const claimedAt = new Date(now);
  const claimed = await claimCandidate(candidate, claimedAt);
  if (!claimed) return "skipped";

  const schema = outboxEventSchemas[candidate.eventName as OutboxEventName];
  const parsed = schema?.safeParse(candidate.payload);
  if (!schema || !parsed?.success) {
    await failInvalidEvent(candidate, claimedAt);
    return "failed";
  }

  try {
    return await sendClaimedEvent(candidate, parsed.data, claimedAt);
  } catch (error) {
    await scheduleRetry(candidate, claimedAt, now, error);
    return "failed";
  }
}

/** Conditional update: only the worker that still sees the same status (and stale claim) wins. */
async function claimCandidate(candidate: OutboxEvent, claimedAt: Date) {
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
  return claim.count === 1;
}

async function failInvalidEvent(candidate: OutboxEvent, claimedAt: Date) {
  await db.outboxEvent.updateMany({
    where: { id: candidate.id, status: OutboxEventStatus.PROCESSING, claimedAt },
    data: {
      status: OutboxEventStatus.FAILED,
      claimedAt: null,
      lastError: "Persisted outbox event has an unsupported name or invalid payload.",
    },
  });
  logger.error(
    { event: "outbox.dispatch_invalid_event", outboxEventId: candidate.id, eventName: candidate.eventName },
    "Outbox event cannot be dispatched",
  );
}

async function sendClaimedEvent(candidate: OutboxEvent, data: unknown, claimedAt: Date): Promise<DispatchOutcome> {
  await inngest.send({
    id: candidate.eventKey,
    name: candidate.eventName as OutboxEventName,
    data,
  });
  const completed = await db.outboxEvent.updateMany({
    where: { id: candidate.id, status: OutboxEventStatus.PROCESSING, claimedAt },
    data: { status: OutboxEventStatus.DISPATCHED, claimedAt: null, dispatchedAt: new Date(), lastError: null },
  });
  return completed.count === 1 ? "dispatched" : "skipped";
}

async function scheduleRetry(candidate: OutboxEvent, claimedAt: Date, now: Date, error: unknown) {
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

function countOutcomes(outcomes: readonly DispatchOutcome[], expected: DispatchOutcome) {
  return outcomes.filter((outcome) => outcome === expected).length;
}
