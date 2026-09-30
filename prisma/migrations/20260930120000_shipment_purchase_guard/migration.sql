CREATE TYPE "ShipmentPurchaseState" AS ENUM ('IN_PROGRESS', 'OUTCOME_UNKNOWN');

ALTER TABLE "shipments"
ADD COLUMN "purchaseState" "ShipmentPurchaseState",
ADD COLUMN "purchaseError" TEXT;
