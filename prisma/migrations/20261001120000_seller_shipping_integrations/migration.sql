CREATE TABLE "seller_shipping_integrations" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MELHOR_ENVIO',
    "accountId" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshLeaseUntil" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_shipping_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_shipping_integrations_sellerId_key"
ON "seller_shipping_integrations"("sellerId");

ALTER TABLE "seller_shipping_integrations"
ADD CONSTRAINT "seller_shipping_integrations_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
