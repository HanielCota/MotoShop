CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PROCESSING',
    "providerId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_deliveries_eventKey_key" ON "notification_deliveries"("eventKey");
CREATE INDEX "notification_deliveries_recipientEmail_createdAt_idx" ON "notification_deliveries"("recipientEmail", "createdAt");
CREATE INDEX "notification_deliveries_status_updatedAt_idx" ON "notification_deliveries"("status", "updatedAt");
