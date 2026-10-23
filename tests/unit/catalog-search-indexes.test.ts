import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/**
 * A10: the catalog text search filters with ILIKE '%term%', which reads the whole table without a
 * trigram index. The migration creates the indexes and the Prisma schema declares them, so a later
 * `migrate dev` does not see them as drift and drop them.
 */
const root = process.cwd();
const migration = readFileSync(
  join(root, "prisma/migrations/20261017100000_catalog_search_trigram_indexes/migration.sql"),
  "utf8",
);
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const catalogQuery = readFileSync(join(root, "src/modules/products/queries/public-product-page.ts"), "utf8");

const searchedColumns = [
  { query: "tp.name ILIKE", table: "products", column: "name", index: "products_name_trgm_idx" },
  { query: "tp.description ILIKE", table: "products", column: "description", index: "products_description_trgm_idx" },
  { query: "v.sku ILIKE", table: "product_variants", column: "sku", index: "product_variants_sku_trgm_idx" },
];

it("creates pg_trgm before any trigram index", () => {
  const extensionAt = migration.indexOf("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

  expect(extensionAt).toBeGreaterThanOrEqual(0);
  expect(extensionAt).toBeLessThan(migration.indexOf("CREATE INDEX"));
});

it.each(searchedColumns)(
  "gives $table.$column, searched with ILIKE, a trigram index in the migration and the schema",
  ({ query, table, column, index }) => {
    expect(catalogQuery).toContain(query);
    expect(migration).toContain(`CREATE INDEX "${index}" ON "${table}" USING GIN ("${column}" gin_trgm_ops);`);
    expect(schema).toContain(`@@index([${column}(ops: raw("gin_trgm_ops"))], map: "${index}", type: Gin)`);
  },
);
