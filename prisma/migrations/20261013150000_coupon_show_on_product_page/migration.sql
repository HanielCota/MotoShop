-- O lojista escolhe quais cupons divulgar na página do produto. Desligado por padrão:
-- cupons existentes continuam sem divulgação.
ALTER TABLE "coupons"
ADD COLUMN "showOnProductPage" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "coupons_sellerId_showOnProductPage_active_idx"
ON "coupons"("sellerId", "showOnProductPage", "active");
