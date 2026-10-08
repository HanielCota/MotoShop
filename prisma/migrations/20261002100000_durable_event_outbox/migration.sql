CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'DISPATCHED', 'FAILED');

CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbox_events_eventKey_key" ON "outbox_events"("eventKey");
CREATE INDEX "outbox_events_status_availableAt_createdAt_idx" ON "outbox_events"("status", "availableAt", "createdAt");
CREATE INDEX "outbox_events_aggregateType_aggregateId_idx" ON "outbox_events"("aggregateType", "aggregateId");
