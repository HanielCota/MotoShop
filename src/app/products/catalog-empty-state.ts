import type { Route } from "next";

import { removeCatalogFilterHref, type CatalogQuery } from "./catalog-query";

type CatalogEmptyStateInput = {
  query: CatalogQuery;
  activeFilterCount: number;
  hasInvalidPriceRange: boolean;
  clearHref: Route;
  /** Same search without the motorcycle filter; 0 when no motorcycle is applied or the result is not empty. */
  totalWithoutMoto: number;
  motoLabel: string;
};

/** Title, message and action of the empty catalog grid, from the most specific reason to the generic one. */
export function catalogEmptyState(input: CatalogEmptyStateInput) {
  const { query, activeFilterCount, hasInvalidPriceRange, clearHref, totalWithoutMoto, motoLabel } = input;

  if (hasInvalidPriceRange) {
    return {
      emptyTitle: "Nenhum produto encontrado",
      emptyMessage: "A faixa de preço está invertida. Corrija os valores para ver os produtos.",
      emptyAction: { label: "Limpar filtros", href: clearHref },
    };
  }
  if (totalWithoutMoto > 0) {
    const results = totalWithoutMoto === 1 ? "1 resultado" : `${totalWithoutMoto} resultados`;
    return {
      emptyTitle: query.q ? `Nenhum resultado para “${query.q}” na sua moto` : "Nenhum produto para a moto escolhida",
      emptyMessage: `Capacetes, roupas e outros equipamentos não dependem de moto. Há ${results} sem o filtro da ${motoLabel}.`,
      emptyAction: {
        label: `Ver ${totalWithoutMoto === 1 ? "o resultado" : `os ${results}`}`,
        href: removeCatalogFilterHref(query, "moto"),
      },
    };
  }
  if (activeFilterCount > 0) {
    return {
      emptyTitle: "Nenhum produto encontrado",
      emptyMessage: "Ajuste ou limpe os filtros para tentar novamente.",
      emptyAction: { label: "Limpar filtros", href: clearHref },
    };
  }
  return { emptyTitle: "Catálogo em preparação", emptyMessage: "Ainda não há produtos publicados no catálogo." };
}
