import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { DesignSelect } from "@/components/ui/design-select";
import Link from "next/link";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";
import { ProductGrid } from "@/modules/products/components/product-grid";
import type { listApprovedProducts } from "@/modules/products/queries/products";
import type {
  publicCatalogAvailabilityValues,
  publicCatalogPromotionValues,
  publicCatalogSortValues,
} from "../search-params";

type ProductsResult = Awaited<ReturnType<typeof listApprovedProducts>>;

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
  function pageHref(nextPage: number) {
    const query = new URLSearchParams();
    if (sort !== "relevance") query.set("sort", sort);
    if (availability !== "ALL") query.set("availability", availability);
    if (promotion !== "ALL") query.set("promotion", promotion);
    if (nextPage > 1) query.set("page", String(nextPage));
    const serialized = query.toString();
    return `${baseHref}${serialized ? `?${serialized}` : ""}` as Route;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div>
        <Badge variant="secondary">Catálogo do Moto Shop</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">{description}</p>
      </div>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{result.total} {result.total === 1 ? "produto" : "produtos"}</h2>
          <Link
            href={allProductsHref as Route}
            className="text-primary text-sm font-medium underline underline-offset-4"
          >
            Ver todos os filtros
          </Link>
        </div>
        <form className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border p-4" method="get">
          <label className="flex min-w-48 flex-col gap-2 text-sm font-medium">
            Ordenar por
            <DesignSelect aria-label="Ordenar por" name="sort" defaultValue={sort}>
              <option value="relevance">Relevância</option>
              <option value="newest">Mais recentes</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
            </DesignSelect>
          </label>
          <label className="flex min-w-48 flex-col gap-2 text-sm font-medium">
            Disponibilidade
            <DesignSelect aria-label="Disponibilidade" name="availability" defaultValue={availability}>
              <option value="ALL">Todos</option>
              <option value="IN_STOCK">Em estoque</option>
              <option value="OUT_OF_STOCK">Indisponíveis</option>
            </DesignSelect>
          </label>
          <label className="flex min-w-48 flex-col gap-2 text-sm font-medium">
            Promoção
            <DesignSelect aria-label="Promoção" name="promotion" defaultValue={promotion}>
              <option value="ALL">Todas</option>
              <option value="ON_SALE">Em promoção</option>
            </DesignSelect>
          </label>
          <Button type="submit" className="rounded-md px-4">
            Aplicar
          </Button>
        </form>
        <ProductGrid products={result.products} />
        {result.pageCount > 1 ? (
          <Pagination
            ariaLabel="Paginação do catálogo"
            page={page}
            pageCount={result.pageCount}
            previousHref={pageHref(page - 1)}
            nextHref={pageHref(page + 1)}
            className="mt-6"
          />
        ) : null}
      </section>
    </main>
  );
}
