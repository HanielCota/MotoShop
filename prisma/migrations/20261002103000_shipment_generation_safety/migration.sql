CREATE TYPE "ShipmentGenerationState" AS ENUM ('IN_PROGRESS', 'OUTCOME_UNKNOWN', 'GENERATED');

ALTER TABLE "shipments"
ADD COLUMN "generationState" "ShipmentGenerationState",
ADD COLUMN "generationError" TEXT,
ADD COLUMN "generatedAt" TIMESTAMP(3);

CREATE INDEX "shipments_generationState_updatedAt_idx"
ON "shipments"("generationState", "updatedAt");
