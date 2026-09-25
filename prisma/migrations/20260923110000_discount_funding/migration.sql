-- Coupon funding is distinct from shipping subsidies. Preserve the shipping constraints.
ALTER TABLE "seller_orders"
  ADD COLUMN "marketplaceDiscountInCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sellerDiscountInCents" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "seller_orders_discount_funding_check" CHECK (
    "marketplaceDiscountInCents" >= 0 AND "sellerDiscountInCents" >= 0 AND
    "marketplaceDiscountInCents" + "sellerDiscountInCents" <= "discountAmountInCents"
  );
