CREATE TABLE "saved_motorcycles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "motorcycleFitmentId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_motorcycles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_motorcycles_userId_motorcycleFitmentId_key" ON "saved_motorcycles"("userId", "motorcycleFitmentId");
CREATE INDEX "saved_motorcycles_userId_isPrimary_idx" ON "saved_motorcycles"("userId", "isPrimary");
CREATE UNIQUE INDEX "saved_motorcycles_one_primary_per_user_idx" ON "saved_motorcycles"("userId") WHERE "isPrimary" = true;

ALTER TABLE "saved_motorcycles" ADD CONSTRAINT "saved_motorcycles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_motorcycles" ADD CONSTRAINT "saved_motorcycles_motorcycleFitmentId_fkey" FOREIGN KEY ("motorcycleFitmentId") REFERENCES "motorcycle_fitments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
