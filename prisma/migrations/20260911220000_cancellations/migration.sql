CREATE TYPE "CancellationRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REFUNDED', 'REJECTED');

CREATE TABLE "cancellation_requests" (
    "id" TEXT NOT NULL,
    "status" "CancellationRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "customerMessage" TEXT,
    "adminNote" TEXT,
    "previousSellerOrderStatus" "SellerOrderStatus" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "requesterUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cancellation_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cancellation_requests_idempotencyKey_key" ON "cancellation_requests"("idempotencyKey");
CREATE INDEX "cancellation_requests_orderId_status_createdAt_idx" ON "cancellation_requests"("orderId", "status", "createdAt");
CREATE INDEX "cancellation_requests_sellerOrderId_status_createdAt_idx" ON "cancellation_requests"("sellerOrderId", "status", "createdAt");
CREATE INDEX "cancellation_requests_sellerId_status_createdAt_idx" ON "cancellation_requests"("sellerId", "status", "createdAt");

ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_sellerOrderId_fkey"
  FOREIGN KEY ("sellerOrderId") REFERENCES "seller_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
