-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('SALE', 'RESERVATION', 'RESERVATION_RELEASE', 'RETURN', 'CANCELLATION', 'MANUAL_IN', 'MANUAL_OUT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'PARTIALLY_CANCELLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SellerOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLATION_REQUESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'AUTHORIZED', 'APPROVED', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentTransactionType" AS ENUM ('AUTHORIZATION', 'CAPTURE', 'REFUND', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CouponOwnerType" AS ENUM ('MARKETPLACE', 'SELLER');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "CouponFundingSource" AS ENUM ('MARKETPLACE', 'SELLER');

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "commissionBpsOverride" INTEGER;

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "weightInGrams" INTEGER,
    "heightInMillimeters" INTEGER,
    "widthInMillimeters" INTEGER,
    "lengthInMillimeters" INTEGER,
    "sellerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "priceInCents" INTEGER NOT NULL,
    "promotionalPriceInCents" INTEGER,
    "promotionStartsAt" TIMESTAMP(3),
    "promotionEndsAt" TIMESTAMP(3),
    "weightInGrams" INTEGER,
    "heightInMillimeters" INTEGER,
    "widthInMillimeters" INTEGER,
    "lengthInMillimeters" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "productId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventories" (
    "id" TEXT NOT NULL,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "variantId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "availableQuantityAfter" INTEGER NOT NULL,
    "reservedQuantityAfter" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reason" TEXT,
    "inventoryId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motorcycle_manufacturers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motorcycle_manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motorcycle_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "manufacturerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motorcycle_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motorcycle_fitments" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '',
    "displacementCc" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "motorcycleModelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motorcycle_fitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_compatibilities" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "motorcycleFitmentId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_compatibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "guestAccessTokenHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "cartId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerTaxId" TEXT,
    "guestAccessTokenHash" TEXT,
    "itemsSubtotalInCents" INTEGER NOT NULL,
    "discountAmountInCents" INTEGER NOT NULL DEFAULT 0,
    "shippingAmountInCents" INTEGER NOT NULL DEFAULT 0,
    "customerShippingAmountInCents" INTEGER NOT NULL DEFAULT 0,
    "marketplaceSubsidyInCents" INTEGER NOT NULL DEFAULT 0,
    "sellerSubsidyInCents" INTEGER NOT NULL DEFAULT 0,
    "totalAmountInCents" INTEGER NOT NULL,
    "userId" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_addresses" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BR',
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_orders" (
    "id" TEXT NOT NULL,
    "status" "SellerOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "storeNameSnapshot" TEXT NOT NULL,
    "itemsSubtotalInCents" INTEGER NOT NULL,
    "discountAmountInCents" INTEGER NOT NULL DEFAULT 0,
    "shippingAmountInCents" INTEGER NOT NULL DEFAULT 0,
    "customerShippingAmountInCents" INTEGER NOT NULL DEFAULT 0,
    "marketplaceSubsidyInCents" INTEGER NOT NULL DEFAULT 0,
    "sellerSubsidyInCents" INTEGER NOT NULL DEFAULT 0,
    "commissionBps" INTEGER NOT NULL,
    "marketplaceCommissionInCents" INTEGER NOT NULL,
    "sellerNetAmountInCents" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "variantDescriptionSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "attributesSnapshot" JSONB NOT NULL DEFAULT '{}',
    "unitPriceInCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "discountAmountInCents" INTEGER NOT NULL DEFAULT 0,
    "totalAmountInCents" INTEGER NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "method" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountInCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "providerMetadata" JSONB,
    "orderId" TEXT NOT NULL,
    "authorizedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "type" "PaymentTransactionType" NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "providerMetadata" JSONB,
    "processedAt" TIMESTAMP(3),
    "paymentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalShipmentId" TEXT,
    "carrier" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "priceInCents" INTEGER NOT NULL,
    "estimatedDeliveryDays" INTEGER,
    "trackingCode" TEXT,
    "trackingUrl" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "sellerOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerType" "CouponOwnerType" NOT NULL,
    "discountType" "CouponDiscountType" NOT NULL,
    "percentageBps" INTEGER,
    "fixedAmountInCents" INTEGER,
    "minimumPurchaseInCents" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "globalUsageLimit" INTEGER,
    "perCustomerUsageLimit" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fundedBy" "CouponFundingSource" NOT NULL,
    "sellerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "customerEmailSnapshot" TEXT NOT NULL,
    "discountAmountInCents" INTEGER NOT NULL,
    "couponId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_configurations" (
    "key" TEXT NOT NULL,
    "defaultCommissionBps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_configurations_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentId_active_sortOrder_idx" ON "categories"("parentId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "categories_parentId_name_key" ON "categories"("parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_active_name_idx" ON "brands"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_sellerId_status_createdAt_idx" ON "products"("sellerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "products_storeId_status_idx" ON "products"("storeId", "status");

-- CreateIndex
CREATE INDEX "products_categoryId_status_idx" ON "products"("categoryId", "status");

-- CreateIndex
CREATE INDEX "products_brandId_status_idx" ON "products"("brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "products_id_sellerId_key" ON "products"("id", "sellerId");

-- CreateIndex
CREATE INDEX "product_variants_productId_active_idx" ON "product_variants"("productId", "active");

-- CreateIndex
CREATE INDEX "product_variants_sellerId_active_idx" ON "product_variants"("sellerId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sellerId_sku_key" ON "product_variants"("sellerId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_id_productId_key" ON "product_variants"("id", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_id_sellerId_key" ON "product_variants"("id", "sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_storageKey_key" ON "product_images"("storageKey");

-- CreateIndex
CREATE INDEX "product_images_productId_sortOrder_idx" ON "product_images"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "product_images_variantId_idx" ON "product_images"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "inventories_variantId_key" ON "inventories"("variantId");

-- CreateIndex
CREATE INDEX "inventories_sellerId_updatedAt_idx" ON "inventories"("sellerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventories_id_sellerId_key" ON "inventories"("id", "sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "inventories_variantId_sellerId_key" ON "inventories"("variantId", "sellerId");

-- CreateIndex
CREATE INDEX "inventory_movements_sellerId_variantId_createdAt_idx" ON "inventory_movements"("sellerId", "variantId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_movements_referenceType_referenceId_idx" ON "inventory_movements"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "inventory_movements_actorUserId_idx" ON "inventory_movements"("actorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "motorcycle_manufacturers_name_key" ON "motorcycle_manufacturers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "motorcycle_manufacturers_slug_key" ON "motorcycle_manufacturers"("slug");

-- CreateIndex
CREATE INDEX "motorcycle_manufacturers_active_name_idx" ON "motorcycle_manufacturers"("active", "name");

-- CreateIndex
CREATE INDEX "motorcycle_models_manufacturerId_active_idx" ON "motorcycle_models"("manufacturerId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "motorcycle_models_manufacturerId_name_key" ON "motorcycle_models"("manufacturerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "motorcycle_models_manufacturerId_slug_key" ON "motorcycle_models"("manufacturerId", "slug");

-- CreateIndex
CREATE INDEX "motorcycle_fitments_motorcycleModelId_year_idx" ON "motorcycle_fitments"("motorcycleModelId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "motorcycle_fitments_motorcycleModelId_version_displacementC_key" ON "motorcycle_fitments"("motorcycleModelId", "version", "displacementCc", "year");

-- CreateIndex
CREATE INDEX "product_compatibilities_sellerId_motorcycleFitmentId_idx" ON "product_compatibilities"("sellerId", "motorcycleFitmentId");

-- CreateIndex
CREATE INDEX "product_compatibilities_motorcycleFitmentId_idx" ON "product_compatibilities"("motorcycleFitmentId");

-- CreateIndex
CREATE UNIQUE INDEX "product_compatibilities_productId_motorcycleFitmentId_key" ON "product_compatibilities"("productId", "motorcycleFitmentId");

-- CreateIndex
CREATE UNIQUE INDEX "carts_guestAccessTokenHash_key" ON "carts"("guestAccessTokenHash");

-- CreateIndex
CREATE INDEX "carts_userId_status_idx" ON "carts"("userId", "status");

-- CreateIndex
CREATE INDEX "carts_status_expiresAt_idx" ON "carts"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "cart_items_variantId_idx" ON "cart_items"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_variantId_key" ON "cart_items"("cartId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "orders_guestAccessTokenHash_key" ON "orders"("guestAccessTokenHash");

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_customerEmail_createdAt_idx" ON "orders"("customerEmail", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_addresses_orderId_key" ON "order_addresses"("orderId");

-- CreateIndex
CREATE INDEX "seller_orders_sellerId_status_createdAt_idx" ON "seller_orders"("sellerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "seller_orders_storeId_status_idx" ON "seller_orders"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "seller_orders_orderId_sellerId_key" ON "seller_orders"("orderId", "sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "seller_orders_id_sellerId_key" ON "seller_orders"("id", "sellerId");

-- CreateIndex
CREATE INDEX "order_items_sellerOrderId_idx" ON "order_items"("sellerOrderId");

-- CreateIndex
CREATE INDEX "order_items_sellerId_createdAt_idx" ON "order_items"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE INDEX "order_items_variantId_idx" ON "order_items"("variantId");

-- CreateIndex
CREATE INDEX "payments_orderId_status_idx" ON "payments"("orderId", "status");

-- CreateIndex
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_externalId_key" ON "payments"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_idempotencyKey_key" ON "payment_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_transactions_paymentId_type_status_idx" ON "payment_transactions"("paymentId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_paymentId_externalId_key" ON "payment_transactions"("paymentId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_sellerOrderId_key" ON "shipments"("sellerOrderId");

-- CreateIndex
CREATE INDEX "shipments_trackingCode_idx" ON "shipments"("trackingCode");

-- CreateIndex
CREATE INDEX "shipments_status_createdAt_idx" ON "shipments"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_provider_externalShipmentId_key" ON "shipments"("provider", "externalShipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_sellerId_active_idx" ON "coupons"("sellerId", "active");

-- CreateIndex
CREATE INDEX "coupons_active_startsAt_endsAt_idx" ON "coupons"("active", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "coupon_redemptions_couponId_userId_idx" ON "coupon_redemptions"("couponId", "userId");

-- CreateIndex
CREATE INDEX "coupon_redemptions_couponId_customerEmailSnapshot_idx" ON "coupon_redemptions"("couponId", "customerEmailSnapshot");

-- CreateIndex
CREATE INDEX "coupon_redemptions_orderId_idx" ON "coupon_redemptions"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_couponId_orderId_key" ON "coupon_redemptions"("couponId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "stores_id_sellerId_key" ON "stores"("id", "sellerId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_storeId_sellerId_fkey" FOREIGN KEY ("storeId", "sellerId") REFERENCES "stores"("id", "sellerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_sellerId_fkey" FOREIGN KEY ("productId", "sellerId") REFERENCES "products"("id", "sellerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "product_variants"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_variantId_sellerId_fkey" FOREIGN KEY ("variantId", "sellerId") REFERENCES "product_variants"("id", "sellerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventoryId_sellerId_fkey" FOREIGN KEY ("inventoryId", "sellerId") REFERENCES "inventories"("id", "sellerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variantId_sellerId_fkey" FOREIGN KEY ("variantId", "sellerId") REFERENCES "product_variants"("id", "sellerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motorcycle_models" ADD CONSTRAINT "motorcycle_models_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "motorcycle_manufacturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motorcycle_fitments" ADD CONSTRAINT "motorcycle_fitments_motorcycleModelId_fkey" FOREIGN KEY ("motorcycleModelId") REFERENCES "motorcycle_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_compatibilities" ADD CONSTRAINT "product_compatibilities_productId_sellerId_fkey" FOREIGN KEY ("productId", "sellerId") REFERENCES "products"("id", "sellerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_compatibilities" ADD CONSTRAINT "product_compatibilities_motorcycleFitmentId_fkey" FOREIGN KEY ("motorcycleFitmentId") REFERENCES "motorcycle_fitments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_compatibilities" ADD CONSTRAINT "product_compatibilities_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_addresses" ADD CONSTRAINT "order_addresses_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_storeId_sellerId_fkey" FOREIGN KEY ("storeId", "sellerId") REFERENCES "stores"("id", "sellerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_sellerOrderId_sellerId_fkey" FOREIGN KEY ("sellerOrderId", "sellerId") REFERENCES "seller_orders"("id", "sellerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "seller_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain integrity checks not expressible in Prisma Schema Language
ALTER TABLE "sellers"
  ADD CONSTRAINT "sellers_commission_bps_check"
  CHECK ("commissionBpsOverride" IS NULL OR "commissionBpsOverride" BETWEEN 0 AND 10000);

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_sort_order_check" CHECK ("sortOrder" >= 0),
  ADD CONSTRAINT "categories_not_own_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id");

ALTER TABLE "products"
  ADD CONSTRAINT "products_dimensions_check"
  CHECK (
    ("weightInGrams" IS NULL OR "weightInGrams" > 0) AND
    ("heightInMillimeters" IS NULL OR "heightInMillimeters" > 0) AND
    ("widthInMillimeters" IS NULL OR "widthInMillimeters" > 0) AND
    ("lengthInMillimeters" IS NULL OR "lengthInMillimeters" > 0)
  ),
  ADD CONSTRAINT "products_review_check"
  CHECK ("status" NOT IN ('APPROVED', 'REJECTED') OR "reviewedAt" IS NOT NULL),
  ADD CONSTRAINT "products_rejection_reason_check"
  CHECK ("status" <> 'REJECTED' OR NULLIF(BTRIM("rejectionReason"), '') IS NOT NULL);

ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_price_check"
  CHECK (
    "priceInCents" >= 0 AND
    ("promotionalPriceInCents" IS NULL OR "promotionalPriceInCents" BETWEEN 0 AND "priceInCents")
  ),
  ADD CONSTRAINT "product_variants_promotion_dates_check"
  CHECK ("promotionStartsAt" IS NULL OR "promotionEndsAt" IS NULL OR "promotionStartsAt" < "promotionEndsAt"),
  ADD CONSTRAINT "product_variants_dimensions_check"
  CHECK (
    ("weightInGrams" IS NULL OR "weightInGrams" > 0) AND
    ("heightInMillimeters" IS NULL OR "heightInMillimeters" > 0) AND
    ("widthInMillimeters" IS NULL OR "widthInMillimeters" > 0) AND
    ("lengthInMillimeters" IS NULL OR "lengthInMillimeters" > 0)
  );

ALTER TABLE "product_images"
  ADD CONSTRAINT "product_images_sort_order_check" CHECK ("sortOrder" >= 0);

ALTER TABLE "inventories"
  ADD CONSTRAINT "inventories_quantities_check"
  CHECK ("availableQuantity" >= 0 AND "reservedQuantity" >= 0),
  ADD CONSTRAINT "inventories_version_check" CHECK ("version" >= 0);

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_change_check" CHECK ("quantityChange" <> 0),
  ADD CONSTRAINT "inventory_movements_balances_check"
  CHECK ("availableQuantityAfter" >= 0 AND "reservedQuantityAfter" >= 0);

ALTER TABLE "motorcycle_fitments"
  ADD CONSTRAINT "motorcycle_fitments_displacement_check" CHECK ("displacementCc" > 0),
  ADD CONSTRAINT "motorcycle_fitments_year_check" CHECK ("year" BETWEEN 1900 AND 2200);

ALTER TABLE "carts"
  ADD CONSTRAINT "carts_owner_check" CHECK ("userId" IS NOT NULL OR "guestAccessTokenHash" IS NOT NULL);

ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_quantity_check" CHECK ("quantity" > 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_customer_access_check" CHECK ("userId" IS NOT NULL OR "guestAccessTokenHash" IS NOT NULL),
  ADD CONSTRAINT "orders_money_check"
  CHECK (
    "itemsSubtotalInCents" >= 0 AND
    "discountAmountInCents" >= 0 AND
    "shippingAmountInCents" >= 0 AND
    "customerShippingAmountInCents" >= 0 AND
    "marketplaceSubsidyInCents" >= 0 AND
    "sellerSubsidyInCents" >= 0 AND
    "totalAmountInCents" >= 0 AND
    "discountAmountInCents" <= "itemsSubtotalInCents" AND
    "marketplaceSubsidyInCents" + "sellerSubsidyInCents" <= "shippingAmountInCents" AND
    "customerShippingAmountInCents" = "shippingAmountInCents" - "marketplaceSubsidyInCents" - "sellerSubsidyInCents" AND
    "totalAmountInCents" = "itemsSubtotalInCents" - "discountAmountInCents" + "customerShippingAmountInCents"
  );

ALTER TABLE "seller_orders"
  ADD CONSTRAINT "seller_orders_commission_bps_check" CHECK ("commissionBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "seller_orders_money_check"
  CHECK (
    "itemsSubtotalInCents" >= 0 AND
    "discountAmountInCents" >= 0 AND
    "shippingAmountInCents" >= 0 AND
    "customerShippingAmountInCents" >= 0 AND
    "marketplaceSubsidyInCents" >= 0 AND
    "sellerSubsidyInCents" >= 0 AND
    "marketplaceCommissionInCents" >= 0 AND
    "sellerNetAmountInCents" >= 0 AND
    "discountAmountInCents" <= "itemsSubtotalInCents" AND
    "marketplaceSubsidyInCents" + "sellerSubsidyInCents" <= "shippingAmountInCents" AND
    "customerShippingAmountInCents" = "shippingAmountInCents" - "marketplaceSubsidyInCents" - "sellerSubsidyInCents"
  );

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_money_check"
  CHECK (
    "unitPriceInCents" >= 0 AND
    "quantity" > 0 AND
    "discountAmountInCents" >= 0 AND
    "discountAmountInCents" <= "unitPriceInCents"::BIGINT * "quantity" AND
    "totalAmountInCents" = "unitPriceInCents"::BIGINT * "quantity" - "discountAmountInCents"
  );

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_check" CHECK ("amountInCents" > 0);

ALTER TABLE "payment_transactions"
  ADD CONSTRAINT "payment_transactions_amount_check" CHECK ("amountInCents" > 0);

ALTER TABLE "shipments"
  ADD CONSTRAINT "shipments_price_check" CHECK ("priceInCents" >= 0),
  ADD CONSTRAINT "shipments_delivery_days_check"
  CHECK ("estimatedDeliveryDays" IS NULL OR "estimatedDeliveryDays" > 0);

ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_owner_check"
  CHECK (
    ("ownerType" = 'MARKETPLACE' AND "sellerId" IS NULL) OR
    ("ownerType" = 'SELLER' AND "sellerId" IS NOT NULL)
  ),
  ADD CONSTRAINT "coupons_funding_check"
  CHECK ("fundedBy" <> 'SELLER' OR "sellerId" IS NOT NULL),
  ADD CONSTRAINT "coupons_discount_check"
  CHECK (
    ("discountType" = 'PERCENTAGE' AND "percentageBps" BETWEEN 1 AND 10000 AND "fixedAmountInCents" IS NULL) OR
    ("discountType" = 'FIXED_AMOUNT' AND "fixedAmountInCents" > 0 AND "percentageBps" IS NULL)
  ),
  ADD CONSTRAINT "coupons_limits_check"
  CHECK (
    "minimumPurchaseInCents" >= 0 AND
    ("globalUsageLimit" IS NULL OR "globalUsageLimit" > 0) AND
    ("perCustomerUsageLimit" IS NULL OR "perCustomerUsageLimit" > 0)
  ),
  ADD CONSTRAINT "coupons_dates_check"
  CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "startsAt" < "endsAt");

ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_discount_check" CHECK ("discountAmountInCents" > 0);

ALTER TABLE "marketplace_configurations"
  ADD CONSTRAINT "marketplace_config_commission_check" CHECK ("defaultCommissionBps" BETWEEN 0 AND 10000);
