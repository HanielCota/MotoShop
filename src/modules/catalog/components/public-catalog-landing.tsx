import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { DesignSelect } from "@/components/ui/design-select";
import Link from "next/link";
import type { Route } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { CatalogFiltersPanel } from "./catalog-filters-panel";
import { CatalogSortSelect } from "./catalog-sort-select";
import { ProductGrid } from "@/modules/products/components/product-grid";
import type { listApprovedProducts } from "@/modules/products/queries/products";
import type {
  publicCatalogAvailabilityValues,
  publicCatalogPromotionValues,
  publicCatalogSortValues,
} from "../search-params";

type ProductsResult = Awaited<ReturnType<typeof listApprovedProducts>>;
type Sort = (typeof publicCatalogSortValues)[number];
type Availability = (typeof publicCatalogAvailabilityValues)[number];
type Promotion = (typeof publicCatalogPromotionValues)[number];

const sortOptions: { value: Sort; label: string }[] = [
  { value: "relevance", label: "Mais relevantes" },
  { value: "newest", label: "Mais recentes" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
];

export function PublicCatalogLanding({
  title,
  description,
  result,
  allProductsHref,
  baseHref,
  page,
  sort,
  availability,
  promotion,
}: {
  title: string;
  description: string;
  result: ProductsResult;
  allProductsHref: string;
  baseHref: string;
  page: number;
  sort: (typeof publicCatalogSortValues)[number];
  availability: (typeof publicCatalogAvailabilityValues)[number];
  promotion: (typeof publicCatalogPromotionValues)[number];
}) {
  function buildHref(overrides: { sort?: Sort; availability?: Availability; promotion?: Promotion; page?: number }) {
    const next = { sort, availability, promotion, page, ...overrides };
    const query = new URLSearchParams();
    if (next.sort !== "relevance") query.set("sort", next.sort);
    if (next.availability !== "ALL") query.set("availability", next.availability);
    if (next.promotion !== "ALL") query.set("promotion", next.promotion);
    if (next.page > 1) query.set("page", String(next.page));
    const serialized = query.toString();
    return `${baseHref}${serialized ? `?${serialized}` : ""}` as Route;
  }
  const activeFilterCount = (availability !== "ALL" ? 1 : 0) + (promotion !== "ALL" ? 1 : 0);
  const clearHref = buildHref({ availability: "ALL", promotion: "ALL", page: 1 });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Catálogo"
        title={title}
        description={description}
        back={{ href: "/products", label: "Voltar ao catálogo" }}
      />
      <div className="grid min-w-0 gap-6 md:grid-cols-[260px_minmax(0,1fr)] md:items-start md:gap-8">
        <CatalogFiltersPanel activeCount={activeFilterCount}>
          <form
            method="get"
            action={baseHref}
            className="grid min-w-0 content-start gap-4 [&_[data-slot=select-trigger]]:h-11 [&_[data-slot=select-trigger]]:w-full"
          >
            {sort !== "relevance" ? <input type="hidden" name="sort" value={sort} /> : null}
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              Disponibilidade
              <DesignSelect aria-label="Disponibilidade" name="availability" defaultValue={availability}>
                <option value="ALL">Todos</option>
                <option value="IN_STOCK">Em estoque</option>
                <option value="OUT_OF_STOCK">Esgotados</option>
              </DesignSelect>
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              Oferta
              <DesignSelect aria-label="Oferta" name="promotion" defaultValue={promotion}>
                <option value="ALL">Todos os preços</option>
                <option value="ON_SALE">Em oferta</option>
              </DesignSelect>
            </label>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" size="lg" className="flex-1 px-4">
                Aplicar filtros
              </Button>
              {activeFilterCount > 0 ? (
                <Link
                  href={clearHref}
                  className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center text-sm underline underline-offset-4"
                >
                  Limpar
                </Link>
              ) : null}
            </div>
            <Link
              href={allProductsHref as Route}
              className="text-brand-strong border-border inline-flex min-h-10 items-center border-t pt-3 text-sm font-medium underline underline-offset-4"
            >
              Mais filtros no catálogo completo
            </Link>
          </form>
        </CatalogFiltersPanel>

        <section className="min-w-0" aria-labelledby="landing-results-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="landing-results-title" className="text-lg" aria-live="polite">
              Página {page} de {result.pageCount} · {result.total} {result.total === 1 ? "produto" : "produtos"}
            </h2>
            <CatalogSortSelect
              value={sort}
              options={sortOptions.map((option) => ({ ...option, href: buildHref({ sort: option.value, page: 1 }) }))}
            />
          </div>
          <ProductGrid
            products={result.products}
            emptyMessage={
              activeFilterCount > 0
                ? "Nenhum produto corresponde aos filtros selecionados."
                : "Ainda não há produtos publicados aqui. Explore o catálogo completo."
            }
            emptyAction={
              activeFilterCount > 0
                ? { label: "Limpar filtros", href: clearHref }
                : { label: "Ver catálogo", href: "/products" }
            }
          />
          <Pagination
            ariaLabel="Paginação do catálogo"
            page={page}
            pageCount={result.pageCount}
            previousHref={buildHref({ page: page - 1 })}
            nextHref={buildHref({ page: page + 1 })}
            className="mt-6"
          />
        </section>
      </div>
    </main>
  );
}
