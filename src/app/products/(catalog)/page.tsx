import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata, Route } from "next";
import { Bike, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DesignSelect } from "@/components/ui/design-select";
import { InlineNotice } from "@/components/ui/inline-notice";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { formatMoneyInCents } from "@/lib/format";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { CatalogFiltersPanel } from "@/modules/catalog/components/catalog-filters-panel";
import { CatalogSearchBand } from "@/modules/catalog/components/catalog-search-band";
import { CatalogSortSelect } from "@/modules/catalog/components/catalog-sort-select";
import {
  getCategoryLabel,
  getCategoryOptionLabel,
  sortCategoriesByOptionLabel,
} from "@/modules/catalog/category-labels";
import { listActiveMotorcycleFitments } from "@/modules/motorcycles/queries/motorcycles";
import { getPrimarySavedMotorcycle } from "@/modules/motorcycles/queries/saved-motorcycles";
import { PriceFilterInput } from "@/modules/products/components/price-filter-input";
import { ProductGrid } from "@/modules/products/components/product-grid";
import { listApprovedProducts, listProductBrands, listProductCategories } from "@/modules/products/queries/products";
import { loadProductsSearchParams, type ProductSort } from "@/modules/products/search-params";
import { listPublicSellerOptions } from "@/modules/sellers/queries/sellers";

import {
  buildCatalogHref,
  catalogFormEntries,
  clearCatalogFiltersHref,
  countActiveCatalogFilters,
  normalizeCatalogPrice,
  removeCatalogFilterHref,
  type CatalogFilterKey,
  type CatalogQuery,
} from "../catalog-query";

export const metadata: Metadata = {
  title: "Catálogo",
};

const sortOptions: { value: ProductSort; label: string }[] = [
  { value: "relevance", label: "Mais relevantes" },
  { value: "newest", label: "Mais recentes" },
  { value: "recent_offers", label: "Ofertas recentes" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
];

type Fitment = Awaited<ReturnType<typeof listActiveMotorcycleFitments>>[number];
type FilterOptions = {
  fitments: Fitment[];
  categories: Awaited<ReturnType<typeof listProductCategories>>;
  brands: Awaited<ReturnType<typeof listProductBrands>>;
  sellers: Awaited<ReturnType<typeof listPublicSellerOptions>>;
};

function fitmentLabel(fitment: Fitment) {
  return [
    `${fitment.motorcycleModel.manufacturer.name} ${fitment.motorcycleModel.name}${fitment.version ? ` ${fitment.version}` : ""}`,
    `${fitment.displacementCc} cc`,
    String(fitment.year),
  ].join(" · ");
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await loadProductsSearchParams(searchParams);
  const [fitments, categories, brands, sellers, session] = await Promise.all([
    listActiveMotorcycleFitments(),
    listProductCategories(),
    listProductBrands(),
    listPublicSellerOptions(),
    getCurrentSession(),
  ]);
  const primaryMotorcycle = session ? await getPrimarySavedMotorcycle(session.user.id) : null;
  const primaryFitment = fitments.find((fitment) => fitment.id === primaryMotorcycle?.motorcycleFitmentId);
  // AGENTS.md: the effective motorcycle filter always lives in the URL (?moto=). When the primary
  // motorcycle is applied by default, make it explicit so the link stays shareable.
  if (params.moto === null && primaryFitment) {
    const explicit = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value])
        explicit.append(key, entry);
    }
    explicit.set("moto", primaryFitment.id);
    redirect(`/products?${explicit.toString()}` as Route);
  }
  const activeMoto = params.moto === "all" ? "" : (params.moto ?? "");
  const query: CatalogQuery = {
    q: params.q,
    moto: activeMoto,
    motoCleared: params.moto === "all",
    category: params.category,
    brand: params.brand,
    seller: params.seller,
    sort: params.sort,
    availability: params.availability,
    minPrice: normalizeCatalogPrice(params.minPrice),
    maxPrice: normalizeCatalogPrice(params.maxPrice),
    promotion: params.promotion,
    page: params.page,
  };
  const hasInvalidPriceRange = query.minPrice !== null && query.maxPrice !== null && query.minPrice > query.maxPrice;
  const result = hasInvalidPriceRange
    ? { products: [], total: 0, page: 1, pageCount: 1 }
    : await listApprovedProducts({
        query: query.q,
        motorcycleFitmentId: activeMoto || null,
        categoryId: query.category,
        brandId: query.brand,
        sellerId: query.seller,
        sort: query.sort,
        availability: query.availability,
        minPriceInCents: query.minPrice,
        maxPriceInCents: query.maxPrice,
        promotion: query.promotion,
        page: query.page,
      });

  const activeFilterCount = countActiveCatalogFilters(query);
  const chips = buildFilterChips(query, { fitments, categories, brands, sellers });
  const clearHref = clearCatalogFiltersHref(query);
  const options = { fitments, categories, brands, sellers };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Catálogo"
        title="Peças, acessórios e equipamentos"
        description="Produtos de lojistas parceiros do Moto Shop."
      />

      <PrimaryMotorcycleBanner
        primary={
          primaryMotorcycle && primaryFitment ? { id: primaryFitment.id, label: fitmentLabel(primaryFitment) } : null
        }
        activeMoto={activeMoto}
        signedIn={Boolean(session)}
        query={query}
      />

      <CatalogSearchBand
        key={query.q ?? ""}
        defaultValue={query.q ?? ""}
        preservedEntries={catalogFormEntries(query, { q: null })}
      />

      <div className="grid min-w-0 gap-6 md:grid-cols-[260px_minmax(0,1fr)] md:items-start md:gap-8">
        {/* Mobile: filtros recolhidos ANTES da grade. Desktop: barra lateral. */}
        <CatalogFiltersPanel activeCount={activeFilterCount} defaultOpen={hasInvalidPriceRange}>
          <CatalogFilterForm query={query} options={options} clearHref={clearHref} />
        </CatalogFiltersPanel>

        <section className="min-w-0" aria-labelledby="catalog-results-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="catalog-results-title" className="text-xl" aria-live="polite">
                {result.total} {result.total === 1 ? "produto" : "produtos"}
              </h2>
              {result.pageCount > 1 ? (
                <p className="text-muted-foreground mt-1 text-sm">
                  Página {result.page} de {result.pageCount}
                </p>
              ) : null}
            </div>
            <CatalogSortSelect
              value={query.sort}
              options={sortOptions.map((option) => ({
                ...option,
                href: buildCatalogHref(query, { sort: option.value, page: 1 }),
              }))}
            />
          </div>

          {chips.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <ul className="flex flex-wrap gap-2" aria-label="Filtros ativos">
                {chips.map((chip) => (
                  <li key={chip.key}>
                    <Link
                      href={removeCatalogFilterHref(query, chip.key)}
                      aria-label={`Remover filtro ${chip.label}`}
                      className="border-moto-brand/30 bg-moto-brand-surface text-brand-strong hover:border-moto-brand focus-visible:ring-ring/40 inline-flex min-h-9 items-center gap-1.5 rounded-full border py-1 pr-2 pl-3 text-xs font-medium focus-visible:ring-3 focus-visible:outline-none"
                    >
                      {chip.label}
                      <X aria-hidden="true" className="size-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={clearHref}
                className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center px-1 text-sm underline underline-offset-4"
              >
                Limpar filtros
              </Link>
            </div>
          ) : null}

          {hasInvalidPriceRange ? (
            <InlineNotice tone="error" className="mb-4">
              O preço mínimo não pode ser maior que o preço máximo. Ajuste os valores e aplique os filtros novamente.
            </InlineNotice>
          ) : null}

          <ProductGrid
            products={result.products}
            emptyTitle={activeFilterCount > 0 ? "Nenhum produto encontrado" : "Catálogo em preparação"}
            emptyMessage={
              hasInvalidPriceRange
                ? "A faixa de preço está invertida. Corrija os valores para ver os produtos."
                : activeFilterCount > 0
                  ? "Ajuste ou limpe os filtros para tentar novamente."
                  : "Ainda não há produtos publicados no catálogo."
            }
            emptyAction={activeFilterCount > 0 ? { label: "Limpar filtros", href: clearHref } : undefined}
          />
          <Pagination
            ariaLabel="Paginação de produtos"
            page={result.page}
            pageCount={result.pageCount}
            previousHref={buildCatalogHref(query, { page: result.page - 1 })}
            nextHref={buildCatalogHref(query, { page: result.page + 1 })}
            className="mt-6"
          />
        </section>
      </div>
    </main>
  );
}

function PrimaryMotorcycleBanner({
  primary,
  activeMoto,
  signedIn,
  query,
}: {
  primary: { id: string; label: string } | null;
  activeMoto: string;
  signedIn: boolean;
  query: CatalogQuery;
}) {
  if (!primary) {
    return (
      <Link
        href={
          (signedIn ? "/account/motorcycles" : `/login?next=${encodeURIComponent("/account/motorcycles")}`) as Route
        }
        className="text-brand-strong inline-flex min-h-10 w-fit items-center gap-2 text-sm font-medium underline underline-offset-4"
      >
        <Bike aria-hidden="true" className="size-4" />
        Salvar minha moto para encontrar peças compatíveis
      </Link>
    );
  }
  const applied = activeMoto === primary.id;
  return (
    <div className="border-moto-brand/30 bg-moto-brand-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm">
      <p className="flex items-center gap-2">
        <Bike aria-hidden="true" className="text-brand-strong size-4 shrink-0" />
        <span>
          <strong>Minha moto principal:</strong> {primary.label}
          {applied ? " · filtro aplicado" : ""}
        </span>
      </p>
      <div className="flex flex-wrap gap-x-4">
        <Link
          href={
            applied ? removeCatalogFilterHref(query, "moto") : buildCatalogHref(query, { moto: primary.id, page: 1 })
          }
          className="text-brand-strong inline-flex min-h-10 items-center font-semibold underline underline-offset-4"
        >
          {applied ? "Ver todas as motos" : "Ver peças para minha moto"}
        </Link>
        <Link
          href="/account/motorcycles"
          className="text-muted-foreground inline-flex min-h-10 items-center underline underline-offset-4"
        >
          Gerenciar motos
        </Link>
      </div>
    </div>
  );
}

function CatalogFilterForm({
  query,
  options,
  clearHref,
}: {
  query: CatalogQuery;
  options: FilterOptions;
  clearHref: Route;
}) {
  const fieldClassName = "flex min-w-0 flex-col gap-2 text-sm font-medium";
  return (
    <form
      key={JSON.stringify(query)}
      id="product-filters"
      action="/products"
      className="grid min-w-0 content-start gap-4 [&_[data-slot=select-trigger]]:h-11 [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:min-w-0 [&_input]:min-w-0"
    >
      {query.sort !== "relevance" ? <input type="hidden" name="sort" value={query.sort} /> : null}
      {/* The search field lives in the band above the results; applying filters keeps the search. */}
      {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
      <label className={fieldClassName}>
        Compatibilidade com moto
        <DesignSelect aria-label="Compatibilidade com moto" name="moto" defaultValue={query.moto || "all"}>
          <option value="all">Todas as motos</option>
          {options.fitments.map((fitment) => (
            <option key={fitment.id} value={fitment.id}>
              {fitmentLabel(fitment)}
            </option>
          ))}
        </DesignSelect>
      </label>
      <label className={fieldClassName}>
        Categoria
        <DesignSelect aria-label="Categoria" name="category" defaultValue={query.category ?? ""}>
          <option value="">Todas as categorias</option>
          {sortCategoriesByOptionLabel(options.categories).map((category) => (
            <option key={category.id} value={category.id}>
              {getCategoryOptionLabel(category)}
            </option>
          ))}
        </DesignSelect>
      </label>
      <label className={fieldClassName}>
        Marca
        <DesignSelect aria-label="Marca" name="brand" defaultValue={query.brand ?? ""}>
          <option value="">Todas as marcas</option>
          {options.brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </DesignSelect>
      </label>
      <label className={fieldClassName}>
        Loja
        <DesignSelect aria-label="Loja" name="seller" defaultValue={query.seller ?? ""}>
          <option value="">Todas as lojas</option>
          {options.sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.store?.name ?? "Sem loja"}
            </option>
          ))}
        </DesignSelect>
      </label>
      <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-1 lg:grid-cols-2">
        <label className={fieldClassName}>
          Preço mínimo (R$)
          <PriceFilterInput name="minPrice" cents={query.minPrice} />
        </label>
        <label className={fieldClassName}>
          Preço máximo (R$)
          <PriceFilterInput name="maxPrice" cents={query.maxPrice} />
        </label>
      </div>
      <label className={fieldClassName}>
        Disponibilidade
        <DesignSelect aria-label="Disponibilidade" name="availability" defaultValue={query.availability}>
          <option value="ALL">Todos</option>
          <option value="IN_STOCK">Em estoque</option>
          <option value="OUT_OF_STOCK">Esgotados</option>
        </DesignSelect>
      </label>
      <label className={fieldClassName}>
        Oferta
        <DesignSelect aria-label="Oferta" name="promotion" defaultValue={query.promotion}>
          <option value="ALL">Todos os preços</option>
          <option value="ON_SALE">Em oferta</option>
        </DesignSelect>
      </label>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" size="lg" className="flex-1 px-4">
          Aplicar filtros
        </Button>
        <Link
          href={clearHref}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center text-sm underline underline-offset-4"
        >
          Limpar
        </Link>
      </div>
    </form>
  );
}

function buildFilterChips(query: CatalogQuery, options: FilterOptions): { key: CatalogFilterKey; label: string }[] {
  const chips: { key: CatalogFilterKey; label: string }[] = [];
  if (query.q) chips.push({ key: "q", label: `Busca: “${query.q}”` });
  if (query.moto) {
    const fitment = options.fitments.find((item) => item.id === query.moto);
    chips.push({ key: "moto", label: fitment ? `Moto: ${fitmentLabel(fitment)}` : "Moto selecionada" });
  }
  if (query.category) {
    const category = options.categories.find((item) => item.id === query.category);
    chips.push({ key: "category", label: category ? getCategoryLabel(category) : "Categoria" });
  }
  if (query.brand) {
    const brand = options.brands.find((item) => item.id === query.brand);
    chips.push({ key: "brand", label: brand ? `Marca: ${brand.name}` : "Marca" });
  }
  if (query.seller) {
    const seller = options.sellers.find((item) => item.id === query.seller);
    chips.push({ key: "seller", label: `Loja: ${seller?.store?.name ?? "selecionada"}` });
  }
  if (query.minPrice !== null || query.maxPrice !== null) {
    const min = query.minPrice !== null ? formatMoneyInCents(query.minPrice) : null;
    const max = query.maxPrice !== null ? formatMoneyInCents(query.maxPrice) : null;
    chips.push({
      key: "price",
      label: min && max ? `${min} a ${max}` : min ? `A partir de ${min}` : `Até ${max}`,
    });
  }
  if (query.availability !== "ALL")
    chips.push({ key: "availability", label: query.availability === "IN_STOCK" ? "Em estoque" : "Esgotados" });
  if (query.promotion === "ON_SALE") chips.push({ key: "promotion", label: "Em oferta" });
  return chips;
}
