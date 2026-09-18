-- CreateEnum
CREATE TYPE "SellerSubscriptionPlan" AS ENUM ('VIP');

-- CreateEnum
CREATE TYPE "SellerSubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "seller_subscriptions" (
    "id" TEXT NOT NULL,
    "plan" "SellerSubscriptionPlan" NOT NULL DEFAULT 'VIP',
    "status" "SellerSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seller_subscriptions_sellerId_status_startsAt_endsAt_idx"
ON "seller_subscriptions"("sellerId", "status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "seller_subscriptions_status_startsAt_endsAt_idx"
ON "seller_subscriptions"("status", "startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "seller_subscriptions"
ADD CONSTRAINT "seller_subscriptions_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
