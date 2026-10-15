import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { $queryRaw: mocks.queryRaw } }));
vi.mock("@/config/env", () => ({ env: { BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters!!" } }));

import { createHash } from "node:crypto";

import { assertRateLimit, consumeRateLimit } from "./consume-rate-limit";

function storedKey(callIndex: number): unknown {
  const query = mocks.queryRaw.mock.calls[callIndex]?.[0] as { values?: unknown[] } | undefined;
  return query?.values?.[0];
}

beforeEach(() => vi.clearAllMocks());

describe("stored key (L-15)", () => {
  it("persists a keyed hash, stable for the same key and not a plain SHA-256", async () => {
    mocks.queryRaw.mockResolvedValue([{ count: 1, resetAt: new Date(Date.now() + 60_000) }]);
    const key = "auth:sign-in-account:rider@example.test";

    await consumeRateLimit({ key, windowSeconds: 60, max: 3 });
    await consumeRateLimit({ key, windowSeconds: 60, max: 3 });
    await consumeRateLimit({ key: "auth:sign-in-account:other@example.test", windowSeconds: 60, max: 3 });

    expect(storedKey(0)).toMatch(/^[0-9a-f]{64}$/);
    expect(storedKey(0)).toBe(storedKey(1));
    expect(storedKey(0)).not.toBe(storedKey(2));
    expect(storedKey(0)).not.toBe(createHash("sha256").update(key).digest("hex"));
    expect(JSON.stringify(mocks.queryRaw.mock.calls)).not.toContain("rider@example.test");
  });
});

describe("atomic rate limit", () => {
  it("allows requests below the limit", async () => {
    mocks.queryRaw.mockResolvedValue([{ count: 2, resetAt: new Date(Date.now() + 60_000) }]);
    await expect(consumeRateLimit({ key: "auth:user-a", windowSeconds: 60, max: 3 })).resolves.toMatchObject({
      allowed: true,
      retryAfter: null,
    });
  });

  it("rejects excess requests without exposing the key in the user error", async () => {
    mocks.queryRaw.mockResolvedValue([{ count: 4, resetAt: new Date(Date.now() + 60_000) }]);
    await expect(assertRateLimit({ key: "auth:user-a", windowSeconds: 60, max: 3 })).rejects.toThrow(
      /Muitas tentativas/,
    );
  });
});
