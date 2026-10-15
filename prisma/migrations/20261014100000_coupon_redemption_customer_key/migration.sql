-- M-07: per-customer coupon limits count the canonical e-mail (lowercase, without "+tag", and for
-- Gmail without dots and with googlemail.com folded into gmail.com) and the order's CPF, so the
-- same customer cannot reuse a coupon by rewriting the address. Additive: one nullable column,
-- filled for existing redemptions with the same rule as canonicalCouponCustomerEmail.
ALTER TABLE "coupon_redemptions" ADD COLUMN "customerEmailKey" TEXT;

UPDATE "coupon_redemptions"
SET "customerEmailKey" = CASE
  WHEN split_part(lower(btrim("customerEmailSnapshot")), '@', 2) IN ('gmail.com', 'googlemail.com')
    THEN replace(regexp_replace(split_part(lower(btrim("customerEmailSnapshot")), '@', 1), '\+.*$', ''), '.', '') || '@gmail.com'
  WHEN position('@' IN "customerEmailSnapshot") > 0
    THEN regexp_replace(split_part(lower(btrim("customerEmailSnapshot")), '@', 1), '\+.*$', '') || '@' || split_part(lower(btrim("customerEmailSnapshot")), '@', 2)
  ELSE lower(btrim("customerEmailSnapshot"))
END;

CREATE INDEX "coupon_redemptions_couponId_customerEmailKey_idx" ON "coupon_redemptions"("couponId", "customerEmailKey");
