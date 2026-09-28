import "server-only";

import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

type CounterResult = { count: number; resetAt: Date };

// A single PostgreSQL upsert is used instead of a read-then-write so concurrent
// requests cannot all pass the same limit. Keys are hashed before persistence.
export async function consumeRateLimit(input: { key: string; windowSeconds: number; max: number }) {
  const key = createHash("sha256").update(input.key).digest("hex");
  const window = Math.max(1, Math.min(Math.ceil(input.windowSeconds), 3600));
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
