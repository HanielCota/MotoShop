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

  it("orders recent offers by active promotion first, newest offer first", async () => {
    await findPublicProductPage({ sort: "recent_offers" }, new Date());

    const statement = defined(mocks.queryRaw.mock.calls[1])[0] as { sql: string };
    expect(statement.sql).toMatch(/bool_or\(o\.sale\) AS "onSale"/);
    expect(statement.sql).toMatch(/COALESCE\(o\."promotionStartsAt", o\."variantUpdatedAt"\)/);
    expect(statement.sql).toMatch(/ORDER BY "onSale" DESC, "offerStartedAt" DESC NULLS LAST, "createdAt" DESC, id ASC/);
  });

  it("requires one active variant to match every chosen attribute, ignoring case for color and size", async () => {
    await findPublicProductPage({ gender: "FEMALE", color: " Preto ", size: "m" }, new Date());

    const statement = defined(mocks.queryRaw.mock.calls[0])[0] as { sql: string; values: unknown[] };
    expect(statement.sql).toContain(
      'EXISTS (SELECT 1 FROM product_variants va WHERE va."productId" = p.id AND va.active = true',
    );
    expect(statement.sql).toContain('va.gender = ?::"VariantGender"');
    expect(statement.sql).toContain("lower(va.color) = lower(?)");
    expect(statement.sql).toContain("lower(va.size) = lower(?)");
    expect(statement.values).toEqual(expect.arrayContaining(["FEMALE", "Preto", "m"]));
  });

  it("ignores empty, unknown or oversized attributes", async () => {
    await findPublicProductPage({ gender: "OTHER" as never, color: "  ", size: "x".repeat(51) }, new Date());

    const statement = defined(mocks.queryRaw.mock.calls[0])[0] as { sql: string };
    expect(statement.sql).not.toContain("product_variants va");
  });

  it("keeps relevance as the default order", async () => {
    await findPublicProductPage({}, new Date());

    const statement = defined(mocks.queryRaw.mock.calls[1])[0] as { sql: string };
    expect(statement.sql).toMatch(/ORDER BY score DESC, "createdAt" DESC, id ASC/);
  });
});

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}
