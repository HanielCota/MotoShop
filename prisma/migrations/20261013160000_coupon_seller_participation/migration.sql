-- Seller opt-in to Moto Shop campaigns (coupons owned by MARKETPLACE and funded by SELLER).
-- Additive only: no existing row changes, so past orders and coupons are untouched.
CREATE TABLE "coupon_seller_participations" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_seller_participations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coupon_seller_participations_couponId_sellerId_key" ON "coupon_seller_participations"("couponId", "sellerId");
CREATE INDEX "coupon_seller_participations_sellerId_leftAt_idx" ON "coupon_seller_participations"("sellerId", "leftAt");
CREATE INDEX "coupon_seller_participations_couponId_leftAt_idx" ON "coupon_seller_participations"("couponId", "leftAt");

ALTER TABLE "coupon_seller_participations" ADD CONSTRAINT "coupon_seller_participations_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coupon_seller_participations" ADD CONSTRAINT "coupon_seller_participations_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
