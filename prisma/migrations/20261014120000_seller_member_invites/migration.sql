-- Convites para a equipe da loja (M-04). Substitui a inclusão direta de membros: o vínculo só é
-- criado quando a pessoa convidada aceita com a conta do mesmo e-mail verificado.
CREATE TYPE "SellerMemberInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');

CREATE TABLE "seller_member_invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "SellerMemberRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "SellerMemberInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sellerId" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "acceptedByUserId" TEXT,

    CONSTRAINT "seller_member_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_member_invites_tokenHash_key" ON "seller_member_invites"("tokenHash");
CREATE INDEX "seller_member_invites_sellerId_status_createdAt_idx" ON "seller_member_invites"("sellerId", "status", "createdAt");
CREATE INDEX "seller_member_invites_email_status_idx" ON "seller_member_invites"("email", "status");

-- No máximo um convite pendente por loja e e-mail; convites respondidos ficam como histórico.
CREATE UNIQUE INDEX "seller_member_invites_one_pending_per_email"
ON "seller_member_invites"("sellerId", "email") WHERE "status" = 'PENDING';

ALTER TABLE "seller_member_invites" ADD CONSTRAINT "seller_member_invites_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seller_member_invites" ADD CONSTRAINT "seller_member_invites_invitedByUserId_fkey"
FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "seller_member_invites" ADD CONSTRAINT "seller_member_invites_acceptedByUserId_fkey"
FOREIGN KEY ("acceptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
