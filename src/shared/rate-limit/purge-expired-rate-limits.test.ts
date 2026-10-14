import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ executeRaw: vi.fn() }));
vi.mock("@/lib/database", () => ({ db: { $executeRaw: mocks.executeRaw } }));

import {
  PURGE_BATCH_SIZE,
  PURGE_MAX_BATCHES,
  purgeExpiredRateLimitBatch,
  purgeExpiredRateLimits,
} from "./purge-expired-rate-limits";

beforeEach(() => vi.clearAllMocks());

describe("purgeExpiredRateLimits (M-10)", () => {
  it("keeps deleting full batches and stops at the first partial one", async () => {
    const deleteBatch = vi
      .fn()
      .mockResolvedValueOnce(PURGE_BATCH_SIZE)
      .mockResolvedValueOnce(PURGE_BATCH_SIZE)
      .mockResolvedValueOnce(12);

    expect(await purgeExpiredRateLimits(deleteBatch)).toEqual({ deleted: PURGE_BATCH_SIZE * 2 + 12, batches: 3 });
    expect(deleteBatch).toHaveBeenCalledTimes(3);
  });

  it("caps one run so it never runs for too long", async () => {
    const deleteBatch = vi.fn().mockResolvedValue(PURGE_BATCH_SIZE);

    expect(await purgeExpiredRateLimits(deleteBatch)).toEqual({
      deleted: PURGE_BATCH_SIZE * PURGE_MAX_BATCHES,
      batches: PURGE_MAX_BATCHES,
    });
  });

  it("deletes only counters that expired more than a day ago, in a bounded batch", async () => {
    mocks.executeRaw.mockResolvedValue(3);

    expect(await purgeExpiredRateLimitBatch(100)).toBe(3);
    const query = mocks.executeRaw.mock.calls[0]?.[0] as { sql: string; values: unknown[] };
    expect(query.sql).toContain(`"resetAt" < now() - INTERVAL '1 day'`);
    expect(query.sql).toContain("LIMIT");
    expect(query.values).toEqual([100]);
  });
});
