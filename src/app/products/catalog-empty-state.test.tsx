import { describe, expect, it } from "vitest";

import { catalogEmptyState } from "./catalog-empty-state";
import type { CatalogQuery } from "./catalog-query";

const query: CatalogQuery = {
  q: "capacete",
  moto: "fitment-1",
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
const input = {
  query,
  activeFilterCount: 2,
  hasInvalidPriceRange: false,
  clearHref: "/products" as const,
  totalWithoutMoto: 0,
  motoLabel: "Honda CRF 250R",
};

describe("catalogEmptyState", () => {
  it("offers the results hidden by the motorcycle filter, keeping the search", () => {
    const state = catalogEmptyState({ ...input, totalWithoutMoto: 9 });

    expect(state.emptyTitle).toBe("Nenhum resultado para “capacete” na sua moto");
    expect(state.emptyMessage).toContain("Há 9 resultados sem o filtro da Honda CRF 250R.");
    expect(state.emptyAction).toMatchObject({
      label: "Ver os 9 resultados",
      href: expect.stringContaining("q=capacete"),
    });
    expect(state.emptyAction).not.toMatchObject({ href: expect.stringContaining("moto=fitment-1") });
  });

  it("falls back to clearing the filters when nothing matches even without the motorcycle", () => {
    const state = catalogEmptyState(input);

    expect(state.emptyTitle).toBe("Nenhum produto encontrado");
    expect(state.emptyAction).toEqual({ label: "Limpar filtros", href: "/products" });
  });

  it("suggests categories when a plain search finds nothing", () => {
    const state = catalogEmptyState({
      ...input,
      query: { ...query, moto: "" },
      activeFilterCount: 1,
      suggestedCategories: [{ slug: "capacetes", name: "Capacetes" }],
    });

    expect(state.emptyMessage).toBe("Confira a grafia ou tente um termo mais geral. Veja também:");
    expect(state.emptyAction).toBeTruthy();
  });

  it("explains an inverted price range before anything else", () => {
    const state = catalogEmptyState({ ...input, hasInvalidPriceRange: true, totalWithoutMoto: 9 });

    expect(state.emptyMessage).toContain("faixa de preço está invertida");
  });
});
