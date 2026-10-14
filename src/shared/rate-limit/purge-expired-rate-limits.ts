import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";

export const PURGE_BATCH_SIZE = 5_000;
export const PURGE_MAX_BATCHES = 20;

/**
 * Deletes one batch of counters whose window ended more than a day ago. Batches keep each
 * statement short on Neon; the index on "resetAt" serves the subquery.
 */
export async function purgeExpiredRateLimitBatch(batchSize = PURGE_BATCH_SIZE): Promise<number> {
  return db.$executeRaw(Prisma.sql`
    DELETE FROM rate_limit_counters
    WHERE key IN (
      SELECT key FROM rate_limit_counters
      WHERE "resetAt" < now() - INTERVAL '1 day'
      LIMIT ${batchSize}
    )
  `);
}

/**
 * M-10: every new key used to stay forever, and anonymous requests can create keys at will
 * (any e-mail on sign-in, any order number). Runs batches until a partial one, capped so a
 * single run never takes too long; the next run continues.
 */
export async function purgeExpiredRateLimits(
  deleteBatch: () => Promise<number> = () => purgeExpiredRateLimitBatch(),
): Promise<{ deleted: number; batches: number }> {
  let deleted = 0;
  for (let batch = 1; batch <= PURGE_MAX_BATCHES; batch++) {
    const removed = await deleteBatch();
    deleted += removed;
    if (removed < PURGE_BATCH_SIZE) return { deleted, batches: batch };
  }
  return { deleted, batches: PURGE_MAX_BATCHES };
}
