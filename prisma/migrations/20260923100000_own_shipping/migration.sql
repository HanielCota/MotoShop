CREATE TABLE "seller_shipping_methods" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sellerId" TEXT NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "postalCodeStart" TEXT NOT NULL,
  "postalCodeEnd" TEXT NOT NULL,
  "priceInCents" INTEGER NOT NULL CHECK ("priceInCents" >= 0),
  "estimatedDeliveryDays" INTEGER NOT NULL CHECK ("estimatedDeliveryDays" BETWEEN 1 AND 365),
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CHECK ("postalCodeStart" ~ '^[0-9]{8}$' AND "postalCodeEnd" ~ '^[0-9]{8}$' AND "postalCodeStart" <= "postalCodeEnd")
);
CREATE INDEX "seller_shipping_methods_sellerId_active_idx" ON "seller_shipping_methods"("sellerId", "active");
