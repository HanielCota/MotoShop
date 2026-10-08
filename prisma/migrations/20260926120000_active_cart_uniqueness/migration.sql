-- Only active carts must be unique. Historical carts retain their owner.
-- Existing duplicate active user carts must be reviewed before this migration.
BEGIN;
DROP INDEX "carts_guestAccessTokenHash_key";
CREATE INDEX "carts_guestAccessTokenHash_status_idx" ON "carts"("guestAccessTokenHash", "status");
CREATE UNIQUE INDEX "carts_active_guest_key" ON "carts"("guestAccessTokenHash") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "carts_active_user_key" ON "carts"("userId") WHERE "status" = 'ACTIVE';
COMMIT;
