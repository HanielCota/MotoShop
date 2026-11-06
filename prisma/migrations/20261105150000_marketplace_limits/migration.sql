-- Limits edited in Admin › Configurações › Limites. Every column is optional: an empty one falls back
-- to the value in the code, so the existing row keeps behaving as it does today.
ALTER TABLE "marketplace_configurations"
  ADD COLUMN "productPhotoLimit" INTEGER,
  ADD COLUMN "photoMaxSizeInMegabytes" INTEGER,
  ADD COLUMN "returnPhotoLimit" INTEGER,
  ADD COLUMN "lastUnitsThreshold" INTEGER,
  ADD COLUMN "lowStockThreshold" INTEGER,
  ADD COLUMN "newProductDays" INTEGER,
  ADD COLUMN "sellerInviteTtlDays" INTEGER;

-- Same ranges the Admin form accepts (MARKETPLACE_LIMIT_BOUNDS), so a bad write can never reach the site.
ALTER TABLE "marketplace_configurations"
  ADD CONSTRAINT "marketplace_config_product_photo_limit_check"
    CHECK ("productPhotoLimit" IS NULL OR "productPhotoLimit" BETWEEN 1 AND 12),
  ADD CONSTRAINT "marketplace_config_photo_max_size_check"
    CHECK ("photoMaxSizeInMegabytes" IS NULL OR "photoMaxSizeInMegabytes" BETWEEN 1 AND 10),
  ADD CONSTRAINT "marketplace_config_return_photo_limit_check"
    CHECK ("returnPhotoLimit" IS NULL OR "returnPhotoLimit" BETWEEN 1 AND 5),
  ADD CONSTRAINT "marketplace_config_last_units_threshold_check"
    CHECK ("lastUnitsThreshold" IS NULL OR "lastUnitsThreshold" BETWEEN 1 AND 20),
  ADD CONSTRAINT "marketplace_config_low_stock_threshold_check"
    CHECK ("lowStockThreshold" IS NULL OR "lowStockThreshold" BETWEEN 1 AND 50),
  ADD CONSTRAINT "marketplace_config_new_product_days_check"
    CHECK ("newProductDays" IS NULL OR "newProductDays" BETWEEN 0 AND 90),
  ADD CONSTRAINT "marketplace_config_seller_invite_ttl_days_check"
    CHECK ("sellerInviteTtlDays" IS NULL OR "sellerInviteTtlDays" BETWEEN 1 AND 30);
