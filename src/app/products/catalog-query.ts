import type { Route } from "next";

import type { VariantGenderValue } from "@/modules/products/domain/variant-attributes";
import type { ProductSort } from "@/modules/products/search-params";

export type CatalogQuery = {
  q: string | null;
  /** Moto efetivamente aplicada ("" = nenhuma). */
  moto: string;
  /** true quando o usuário escolheu "Todas as motos" explicitamente (não reaplicar a moto principal). */
  motoCleared: boolean;
  category: string | null;
  brand: string | null;
  seller: string | null;
  sort: ProductSort;
  availability: "ALL" | "IN_STOCK" | "OUT_OF_STOCK";
  minPrice: number | null;
  maxPrice: number | null;
  promotion: "ALL" | "ON_SALE";
  gender: VariantGenderValue | null;
  color: string | null;
  size: string | null;
  page: number;
};

/**
 * Price bounds from the URL in cents. Negative or non-integer values are ignored by the query, so
 * they must not become a filter chip ("A partir de -R$ 1,00") or an input value the form rejects.
 */
export function normalizeCatalogPrice(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export type CatalogFilterKey =
  "q" | "moto" | "category" | "brand" | "seller" | "availability" | "price" | "promotion" | "gender" | "color" | "size";

/** Serializa o estado do catálogo para `/products?...`, omitindo valores padrão. */
export function buildCatalogHref(query: CatalogQuery, overrides: Partial<CatalogQuery> = {}): Route {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.moto) params.set("moto", next.moto);
  if (!next.moto && next.motoCleared) params.set("moto", "all");
  if (next.category) params.set("category", next.category);
  if (next.brand) params.set("brand", next.brand);
  if (next.seller) params.set("seller", next.seller);
  if (next.sort !== "relevance") params.set("sort", next.sort);
  if (next.availability !== "ALL") params.set("availability", next.availability);
  if (next.minPrice !== null) params.set("minPrice", String(next.minPrice));
  if (next.maxPrice !== null) params.set("maxPrice", String(next.maxPrice));
  if (next.promotion !== "ALL") params.set("promotion", next.promotion);
  if (next.gender) params.set("gender", next.gender);
  if (next.color) params.set("color", next.color);
  if (next.size) params.set("size", next.size);
  if (next.page > 1) params.set("page", String(next.page));
  const serialized = params.toString();
  return (serialized ? `/products?${serialized}` : "/products") as Route;
}

/**
 * Hidden fields for a form that changes only part of the catalog state: the other filters and the
 * sort are kept, and the page restarts at 1.
 */
export function catalogFormEntries(query: CatalogQuery, overrides: Partial<CatalogQuery>): [string, string][] {
  const href = buildCatalogHref(query, { ...overrides, page: 1 });
  const search = href.split("?")[1] ?? "";
  return [...new URLSearchParams(search).entries()];
}

/** URL sem um filtro específico (volta para a página 1). */
export function removeCatalogFilterHref(query: CatalogQuery, key: CatalogFilterKey): Route {
  const reset: Partial<CatalogQuery> = { page: 1 };
  switch (key) {
    case "moto":
      return buildCatalogHref(query, { ...reset, moto: "", motoCleared: true });
    case "price":
      return buildCatalogHref(query, { ...reset, minPrice: null, maxPrice: null });
    case "availability":
      return buildCatalogHref(query, { ...reset, availability: "ALL" });
    case "promotion":
      return buildCatalogHref(query, { ...reset, promotion: "ALL" });
    default:
      return buildCatalogHref(query, { ...reset, [key]: null });
  }
}

/** Remove todos os filtros mantendo apenas a ordenação. */
export function clearCatalogFiltersHref(query: CatalogQuery): Route {
  return buildCatalogHref({
    q: null,
    moto: "",
    motoCleared: true,
    category: null,
    brand: null,
    seller: null,
    sort: query.sort,
    availability: "ALL",
    minPrice: null,
    maxPrice: null,
    promotion: "ALL",
    gender: null,
    color: null,
    size: null,
    page: 1,
  });
}

export function countActiveCatalogFilters(query: CatalogQuery) {
  return [
    query.q,
    query.moto,
    query.category,
    query.brand,
    query.seller,
    query.availability !== "ALL",
    query.minPrice !== null || query.maxPrice !== null,
    query.promotion !== "ALL",
    query.gender,
    query.color,
    query.size,
  ].filter(Boolean).length;
}
