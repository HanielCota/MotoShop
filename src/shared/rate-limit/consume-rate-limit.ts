import "server-only";

import { createHmac } from "node:crypto";

import { env } from "@/config/env";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

type CounterResult = { count: number; resetAt: Date };

// L-15: keys may contain an e-mail. A plain SHA-256 can be reversed with a dictionary by anyone
// who reads the table, so keys are HMACed with a key derived from the server secret (a separate
// derivation, so the auth secret itself is never used directly here).
const rateLimitKeySecret = createHmac("sha256", env.BETTER_AUTH_SECRET).update("motoshop:rate-limit-keys:v1").digest();

function hashRateLimitKey(key: string): string {
  return createHmac("sha256", rateLimitKeySecret).update(key).digest("hex");
}

// A single PostgreSQL upsert is used instead of a read-then-write so concurrent
// requests cannot all pass the same limit. Keys are hashed before persistence.
export async function consumeRateLimit(input: { key: string; windowSeconds: number; max: number }) {
  const key = hashRateLimitKey(input.key);
  const window = Math.max(1, Math.min(Math.ceil(input.windowSeconds), 86_400));
  const max = Math.max(1, Math.min(Math.ceil(input.max), 10000));
  const rows = await db.$queryRaw<CounterResult[]>(Prisma.sql`
    INSERT INTO rate_limit_counters (key, count, "resetAt")
    VALUES (${key}, 1, now() + (${window} * INTERVAL '1 second'))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit_counters."resetAt" <= now() THEN 1 ELSE rate_limit_counters.count + 1 END,
      "resetAt" = CASE WHEN rate_limit_counters."resetAt" <= now() THEN now() + (${window} * INTERVAL '1 second') ELSE rate_limit_counters."resetAt" END
    RETURNING count, "resetAt"
  `);
  const result = rows[0];
  if (!result) throw new Error("Rate limit counter was not persisted.");
  return {
    allowed: result.count <= max,
    retryAfter: result.count <= max ? null : Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)),
  };
}

/** Reads a counter without consuming it: `blocked` once `max` hits happened inside the current window. */
export async function peekRateLimit(input: { key: string; max: number }) {
  const rows = await db.$queryRaw<CounterResult[]>(Prisma.sql`
    SELECT count, "resetAt" FROM rate_limit_counters
    WHERE key = ${hashRateLimitKey(input.key)} AND "resetAt" > now()
  `);
  const counter = rows[0];
  if (!counter || counter.count < input.max) return { blocked: false, retryAfter: null };

  return {
    blocked: true,
    retryAfter: Math.max(1, Math.ceil((counter.resetAt.getTime() - Date.now()) / 1000)),
  };
}

/** Forgets a counter, e.g. after a successful sign-in. */
export async function clearRateLimit(key: string): Promise<void> {
  await db.$executeRaw(Prisma.sql`DELETE FROM rate_limit_counters WHERE key = ${hashRateLimitKey(key)}`);
}

export async function assertRateLimit(input: { key: string; windowSeconds: number; max: number }) {
  const result = await consumeRateLimit(input);
  if (!result.allowed) {
    throw new ApplicationError({
      code: "CONFLICT",
      statusCode: 429,
      message: "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.",
    });
  }
}
