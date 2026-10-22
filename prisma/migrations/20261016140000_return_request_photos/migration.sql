-- Fotos que o cliente anexa ao pedir devolução: até 3 por solicitação, arquivos
-- privados no ImageKit que só abrem por link assinado. O sellerId repete o da devolução para
-- que as consultas da loja filtrem pelo dono também nesta tabela.
CREATE TABLE "return_request_photos" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeInBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_request_photos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "return_request_photos_contentType_check" CHECK ("contentType" IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT "return_request_photos_sizeInBytes_check" CHECK ("sizeInBytes" > 0),
    CONSTRAINT "return_request_photos_sortOrder_check" CHECK ("sortOrder" BETWEEN 0 AND 2)
);

CREATE UNIQUE INDEX "return_request_photos_storageKey_key" ON "return_request_photos"("storageKey");
CREATE INDEX "return_request_photos_returnRequestId_sortOrder_idx" ON "return_request_photos"("returnRequestId", "sortOrder");
CREATE INDEX "return_request_photos_sellerId_idx" ON "return_request_photos"("sellerId");

ALTER TABLE "return_request_photos" ADD CONSTRAINT "return_request_photos_returnRequestId_fkey"
    FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_request_photos" ADD CONSTRAINT "return_request_photos_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
