-- "Campanha com adesão": a Moto Shop coupon (ownerType MARKETPLACE, sellerId NULL) paid by each
-- seller that joins (fundedBy SELLER, see coupon_seller_participations). The original check
-- required a sellerId for every seller-funded coupon, which rejected campaigns.
-- Only relaxes the rule: every existing row already satisfies the new check. coupons_owner_check
-- (MARKETPLACE => sellerId NULL, SELLER => sellerId NOT NULL) is unchanged.
ALTER TABLE "coupons" DROP CONSTRAINT "coupons_funding_check";

ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_funding_check"
  CHECK ("fundedBy" <> 'SELLER' OR "sellerId" IS NOT NULL OR "ownerType" = 'MARKETPLACE');
