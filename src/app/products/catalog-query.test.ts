import { describe, expect, it } from "vitest";

import {
  buildCatalogHref,
  catalogFormEntries,
  clearCatalogFiltersHref,
  countActiveCatalogFilters,
  hasSecondaryCatalogFilter,
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
  gender: null,
  color: null,
  size: null,
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

  it("keeps variant attributes in the URL and removes them one at a time", () => {
    const query = { ...base, gender: "FEMALE" as const, color: "Preto", size: "M" };
    expect(buildCatalogHref(query)).toBe("/products?gender=FEMALE&color=Preto&size=M");
    expect(removeCatalogFilterHref(query, "color")).toBe("/products?gender=FEMALE&size=M");
    expect(countActiveCatalogFilters(query)).toBe(3);
    expect(clearCatalogFiltersHref(query)).toBe("/products?moto=all");
  });

  it("counts price range as one filter", () => {
    expect(countActiveCatalogFilters({ ...base, minPrice: 1, maxPrice: 2, q: "x" })).toBe(2);
  });

  it("keeps the other filters as hidden fields for the search band, restarting at page 1", () => {
    const query = { ...base, q: "old", moto: "m1", brand: "b1", sort: "price_asc" as const, page: 4 };
    expect(catalogFormEntries(query, { q: null })).toEqual([
      ["moto", "m1"],
      ["brand", "b1"],
      ["sort", "price_asc"],
    ]);
  });

  it("keeps an explicit 'all motorcycles' choice in the search band", () => {
    expect(catalogFormEntries({ ...base, motoCleared: true }, { q: null })).toEqual([["moto", "all"]]);
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

describe("hasSecondaryCatalogFilter", () => {
  it('keeps "Mais filtros" closed when only the main filters are in use', () => {
    expect(hasSecondaryCatalogFilter({ ...base, category: "helmets", brand: "fox", seller: "seller-1" })).toBe(false);
  });

  it.each([
    ["gender", { gender: "MALE" as const }],
    ["color", { color: "Preto" }],
    ["size", { size: "M" }],
    ["minimum price", { minPrice: 0 }],
    ["maximum price", { maxPrice: 50_000 }],
    ["availability", { availability: "IN_STOCK" as const }],
    ["offer", { promotion: "ON_SALE" as const }],
  ])('opens "Mais filtros" when the %s filter is in use', (_name, filter) => {
    expect(hasSecondaryCatalogFilter({ ...base, ...filter })).toBe(true);
  });
});
