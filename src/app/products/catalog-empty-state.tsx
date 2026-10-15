import type { Route } from "next";
import Link from "next/link";

import { removeCatalogFilterHref, type CatalogQuery } from "./catalog-query";

type CatalogEmptyStateInput = {
  query: CatalogQuery;
  activeFilterCount: number;
  hasInvalidPriceRange: boolean;
  clearHref: Route;
  /** Same search without the motorcycle filter; 0 when no motorcycle is applied or the result is not empty. */
  totalWithoutMoto: number;
  motoLabel: string;
  /** Shown when a free-text search finds nothing at all, so the customer has somewhere to go. */
  suggestedCategories?: { slug: string; name: string }[];
};

/** Title, message and action of the empty catalog grid, from the most specific reason to the generic one. */
export function catalogEmptyState(input: CatalogEmptyStateInput) {
  const { query, activeFilterCount, hasInvalidPriceRange, clearHref, totalWithoutMoto, motoLabel } = input;
  const suggestedCategories = input.suggestedCategories ?? [];

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
  if (query.q && activeFilterCount === 1 && suggestedCategories.length > 0) {
    return {
      emptyTitle: "Nenhum produto encontrado",
      emptyMessage: "Confira a grafia ou tente um termo mais geral. Veja também:",
      emptyAction: categoryLinks(suggestedCategories),
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

const categoryLinkClassName =
  "border-border hover:border-foreground/30 inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium";

function categoryLinks(categories: { slug: string; name: string }[]) {
  return (
    <ul className="flex flex-wrap justify-center gap-2" aria-label="Categorias sugeridas">
      {categories.map((category) => (
        <li key={category.slug}>
          <Link href={`/categoria/${category.slug}` as Route} className={categoryLinkClassName}>
            {category.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
