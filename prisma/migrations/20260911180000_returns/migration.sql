CREATE TYPE "ReturnStatus" AS ENUM (
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'WAITING_RETURN',
  'RETURNED',
  'REFUNDED',
  'REJECTED'
);

CREATE TABLE "return_requests" (
  "id" TEXT NOT NULL,
  "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
  "reason" TEXT NOT NULL,
  "customerMessage" TEXT,
  "adminNote" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "sellerOrderId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "requesterUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "return_items" (
  "id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "sellerOrderId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "return_requests_idempotencyKey_key" ON "return_requests"("idempotencyKey");
CREATE INDEX "return_requests_orderId_status_createdAt_idx" ON "return_requests"("orderId", "status", "createdAt");
CREATE INDEX "return_requests_sellerOrderId_status_createdAt_idx" ON "return_requests"("sellerOrderId", "status", "createdAt");
CREATE INDEX "return_requests_sellerId_status_createdAt_idx" ON "return_requests"("sellerId", "status", "createdAt");
CREATE UNIQUE INDEX "return_items_returnRequestId_orderItemId_key" ON "return_items"("returnRequestId", "orderItemId");
CREATE INDEX "return_items_orderItemId_createdAt_idx" ON "return_items"("orderItemId", "createdAt");
CREATE INDEX "return_items_sellerOrderId_sellerId_idx" ON "return_items"("sellerOrderId", "sellerId");

ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_sellerOrderId_fkey"
  FOREIGN KEY ("sellerOrderId") REFERENCES "seller_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_returnRequestId_fkey"
  FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
