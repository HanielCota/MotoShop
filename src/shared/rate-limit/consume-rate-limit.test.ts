import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { $queryRaw: mocks.queryRaw } }));

import { assertRateLimit, consumeRateLimit } from "./consume-rate-limit";

beforeEach(() => vi.clearAllMocks());

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
