import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { $queryRaw: mocks.queryRaw } }));

import { findPublicProductPage } from "./public-product-page";

describe("findPublicProductPage", () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset();
    mocks.queryRaw.mockResolvedValueOnce([{ total: BigInt(0) }]).mockResolvedValueOnce([]);
  });

  it("binds price bounds as bigint so values above INT4 do not make PostgreSQL reject the query", async () => {
    await findPublicProductPage({ minPriceInCents: 99_999_999_999_999, maxPriceInCents: 2_147_483_648 }, new Date());

    const statement = defined(mocks.queryRaw.mock.calls[0])[0] as { sql: string; values: unknown[] };
    expect(statement.sql).toMatch(/o\.price >= \?::bigint/);
    expect(statement.sql).toMatch(/o\.price <= \?::bigint/);
    expect(statement.values).toContain(99_999_999_999_999);
  });
});

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}
