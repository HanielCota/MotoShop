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
    const offers = statement.sql.split("), matches AS (")[0];
    expect(offers).toContain('v.gender = ?::"VariantGender"');
    expect(offers).toContain("lower(v.color) = lower(?)");
    expect(offers).toContain("lower(v.size) = lower(?)");
    expect(statement.values).toEqual(expect.arrayContaining(["FEMALE", "Preto", "m"]));
  });

  it("ignores empty, unknown or oversized attributes", async () => {
    await findPublicProductPage({ gender: "OTHER" as never, color: "  ", size: "x".repeat(51) }, new Date());

    const statement = defined(mocks.queryRaw.mock.calls[0])[0] as { sql: string };
    expect(statement.sql).not.toMatch(/v\.(gender|color|size)/);
  });

  it("with a motorcycle chosen, returns compatible products plus those of universal categories and their subcategories", async () => {
    await findPublicProductPage({ motorcycleFitmentId: "fitment-crf" }, new Date());

    const statement = defined(mocks.queryRaw.mock.calls[0])[0] as { sql: string; values: unknown[] };
    expect(statement.sql).toMatch(/^WITH RECURSIVE universal_categories AS \(/);
    expect(statement.sql).toContain("SELECT id FROM categories WHERE universal = true");
    expect(statement.sql).toContain('JOIN universal_categories parent ON child."parentId" = parent.id');
    expect(statement.sql).toMatch(
      /AND \(EXISTS \(SELECT 1 FROM product_compatibilities pc WHERE pc\."productId" = p\.id AND pc\."motorcycleFitmentId" IN \(\?\)\)\s+OR p\."categoryId" IN \(SELECT id FROM universal_categories\)\)/,
    );
    expect(statement.values).toContain("fitment-crf");
  });

  it("applies the same motorcycle rule to the page of ids, so count and pagination agree", async () => {
    await findPublicProductPage({ motorcycleFitmentIds: ["fitment-a", "fitment-b"] }, new Date());

    const page = defined(mocks.queryRaw.mock.calls[1])[0] as { sql: string };
    expect(page.sql).toContain('OR p."categoryId" IN (SELECT id FROM universal_categories)');
  });

  it("leaves universal categories out when no motorcycle is chosen", async () => {
    await findPublicProductPage({}, new Date());

    const statement = defined(mocks.queryRaw.mock.calls[0])[0] as { sql: string };
    expect(statement.sql).toMatch(/^WITH\s+offers AS \(/);
    expect(statement.sql).not.toContain("universal");
  });

  it("searches each text column in its own UNION branch, so the trigram indexes can be used", async () => {
    await findPublicProductPage({ query: " Capacete " }, new Date());

    const statement = defined(mocks.queryRaw.mock.calls[0])[0] as { sql: string; values: unknown[] };
    expect(statement.sql).toContain("AND p.id IN (");
    expect(statement.sql).toContain("SELECT tp.id FROM products tp WHERE tp.name ILIKE ? OR tp.description ILIKE ?");
    expect(statement.sql).toMatch(
      /UNION SELECT tb\.id FROM products tb JOIN brands mb ON mb\.id = tb\."brandId" WHERE mb\.name ILIKE \?/,
    );
    expect(statement.sql).toMatch(
      /UNION SELECT tc\.id FROM products tc JOIN categories mc ON mc\.id = tc\."categoryId" WHERE mc\.name ILIKE \?/,
    );
    expect(statement.sql).toMatch(
      /UNION SELECT ts\.id FROM products ts JOIN stores ms ON ms\.id = ts\."storeId" WHERE ms\.name ILIKE \?/,
    );
    expect(statement.sql).toMatch(
      /UNION SELECT v\."productId" FROM product_variants v WHERE v\.active = true AND v\.sku ILIKE \?/,
    );
    expect(statement.sql).not.toContain("FROM offers sk");
    expect(statement.values).toContain("%capacete%");
  });

  it("escapes LIKE wildcards typed in the search", async () => {
    await findPublicProductPage({ query: "50%_a\\b" }, new Date());

    const statement = defined(mocks.queryRaw.mock.calls[0])[0] as { values: unknown[] };
    expect(statement.values).toContain("%50\\%\\_a\\\\b%");
  });

  it("matches a SKU only on active variants that also match the chosen attributes", async () => {
    await findPublicProductPage({ query: "sku-1", color: "Preto" }, new Date());

    const statement = defined(mocks.queryRaw.mock.calls[0])[0] as { sql: string };
    const skuBranch = defined(statement.sql.split('UNION SELECT v."productId"')[1]);
    expect(skuBranch).toMatch(
      /^ FROM product_variants v WHERE v\.active = true AND v\.sku ILIKE \?\s+AND lower\(v\.color\) = lower\(\?\)/,
    );
  });

  it("leaves the text search out when the query is blank", async () => {
    await findPublicProductPage({ query: "   " }, new Date());

    const statement = defined(mocks.queryRaw.mock.calls[0])[0] as { sql: string };
    expect(statement.sql).not.toContain("ILIKE");
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
