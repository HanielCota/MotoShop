import { describe, expect, it } from "vitest";

import {
  buildCatalogHref,
  clearCatalogFiltersHref,
  countActiveCatalogFilters,
  normalizeCatalogPrice,
  removeCatalogFilterHref,
  type CatalogQuery,
} from "./catalog-query";

const base: CatalogQuery = {
  q: null,
  moto: "",
  motoCleared: false,
  category: null,
  brand: null,
  seller: null,
  sort: "relevance",
  availability: "ALL",
  minPrice: null,
  maxPrice: null,
  promotion: "ALL",
  page: 1,
};

describe("catalog query", () => {
  it("omits defaults", () => expect(buildCatalogHref(base)).toBe("/products"));

  it("removes a single filter and resets the page", () => {
    const query = { ...base, q: "filtro", brand: "b1", page: 3 };
    expect(removeCatalogFilterHref(query, "brand")).toBe("/products?q=filtro");
  });

  it("keeps the user's explicit 'all motorcycles' choice when removing the moto filter", () => {
    expect(removeCatalogFilterHref({ ...base, moto: "m1" }, "moto")).toBe("/products?moto=all");
  });

  it("clears filters but keeps sort", () => {
    expect(clearCatalogFiltersHref({ ...base, q: "x", sort: "price_asc", minPrice: 100 })).toBe(
      "/products?moto=all&sort=price_asc",
    );
  });

  it("counts price range as one filter", () => {
    expect(countActiveCatalogFilters({ ...base, minPrice: 1, maxPrice: 2, q: "x" })).toBe(2);
  });
});

describe("normalizeCatalogPrice", () => {
  it("keeps non-negative integer cents and drops values the query ignores", () => {
    expect(normalizeCatalogPrice(0)).toBe(0);
    expect(normalizeCatalogPrice(15_000)).toBe(15_000);
    expect(normalizeCatalogPrice(-100)).toBeNull();
    expect(normalizeCatalogPrice(1e20)).toBeNull();
    expect(normalizeCatalogPrice(null)).toBeNull();
  });
});
