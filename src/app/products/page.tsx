import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { DesignSelect } from "@/components/ui/design-select";
import Link from "next/link";
import type { Route } from "next";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { listActiveMotorcycleFitments } from "@/modules/motorcycles/queries/motorcycles";
import { ProductGrid } from "@/modules/products/components/product-grid";
import { PriceFilterInput } from "@/modules/products/components/price-filter-input";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { listApprovedProducts, listProductBrands, listProductCategories } from "@/modules/products/queries/products";
import { loadProductsSearchParams } from "@/modules/products/search-params";
import { listPublicSellerOptions } from "@/modules/sellers/queries/sellers";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getPrimarySavedMotorcycle } from "@/modules/motorcycles/queries/saved-motorcycles";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await loadProductsSearchParams(searchParams);
  const [result, fitments, categories, brands, sellers, session] = await Promise.all([
    listApprovedProducts({
      query: params.q,
      motorcycleFitmentId: params.moto,
      categoryId: params.category,
      brandId: params.brand,
      sellerId: params.seller,
      sort: params.sort,
      availability: params.availability,
      minPriceInCents: params.minPrice,
      maxPriceInCents: params.maxPrice,
      promotion: params.promotion,
      page: params.page,
    }),
    listActiveMotorcycleFitments(),
    listProductCategories(),
    listProductBrands(),
    listPublicSellerOptions(),
    getCurrentSession(),
  ]);
  const primaryMotorcycle = session ? await getPrimarySavedMotorcycle(session.user.id) : null;
  const primaryFitment = fitments.find((fitment) => fitment.id === primaryMotorcycle?.motorcycleFitmentId);
  const primaryLabel = primaryFitment
    ? `${primaryFitment.motorcycleModel.manufacturer.name} ${primaryFitment.motorcycleModel.name} · ${primaryFitment.year}`
    : null;
  function pageHref(page: number): Route {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.moto) query.set("moto", params.moto);
    if (params.category) query.set("category", params.category);
    if (params.brand) query.set("brand", params.brand);
    if (params.seller) query.set("seller", params.seller);
    if (params.sort !== "relevance") query.set("sort", params.sort);
    if (params.availability !== "ALL") query.set("availability", params.availability);
    if (params.minPrice !== null && params.minPrice !== undefined) query.set("minPrice", String(params.minPrice));
    if (params.maxPrice !== null && params.maxPrice !== undefined) query.set("maxPrice", String(params.maxPrice));
    if (params.promotion !== "ALL") query.set("promotion", params.promotion);
    if (page > 1) query.set("page", String(page));
    const serialized = query.toString();
    return (serialized ? `/products?${serialized}` : "/products") as Route;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div>
        <Badge variant="secondary">Catálogo</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Produtos para sua próxima sessão</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          Encontre peças, equipamentos e acessórios aprovados pela Moto Shop.
        </p>
      </div>
      {primaryMotorcycle && primaryLabel ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f4c8ad] bg-[#fff4eb] p-4 text-sm">
          <p>
            <strong>Minha moto principal:</strong> {primaryLabel}
            {params.moto === primaryMotorcycle.motorcycleFitmentId ? " · filtro ativo" : ""}
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href={`/products?moto=${encodeURIComponent(primaryMotorcycle.motorcycleFitmentId)}` as Route}
              className="font-semibold text-[#a63a0b] underline underline-offset-4"
            >
              Ver peças para minha moto
            </Link>
            <Link href="/account/motorcycles" className="text-muted-foreground underline underline-offset-4">
              Gerenciar motos
            </Link>
          </div>
        </div>
      ) : (
        <Link href="/account/motorcycles" className="text-sm font-medium text-[#a63a0b] underline underline-offset-4">
          Salvar minha moto para encontrar peças compatíveis
        </Link>
      )}
      <form
        key={JSON.stringify(params)}
        className="grid min-w-0 gap-3 rounded-xl border p-4 md:grid-cols-2 [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:min-w-0 [&_input]:min-w-0 [&_label]:min-w-0"
      >
        <label className="flex flex-col gap-2 text-sm font-medium">
          Buscar
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Produto, SKU, marca ou loja..." />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Minha Moto
          <DesignSelect aria-label="Minha Moto" name="moto" defaultValue={params.moto ?? ""}>
            <option value="">Todas as motos</option>
            {fitments.map((fitment) => (
              <option key={fitment.id} value={fitment.id}>
                {fitment.motorcycleModel.manufacturer.name} {fitment.motorcycleModel.name} {fitment.version} ·{" "}
                {fitment.displacementCc} cc · {fitment.year}
              </option>
            ))}
          </DesignSelect>
        </label>
        <Button type="submit" size="lg" className="rounded-md px-4 md:w-fit">
          Aplicar busca
        </Button>
        <details
          className="min-w-0 md:col-span-2"
          open={Boolean(
            params.category ||
            params.brand ||
            params.seller ||
            params.minPrice !== null ||
            params.maxPrice !== null ||
            params.availability !== "ALL" ||
            params.promotion !== "ALL" ||
            params.sort !== "relevance",
          )}
        >
          <summary className="focus-visible:ring-ring/40 flex cursor-pointer list-none items-center justify-between gap-2 rounded-md py-3 text-sm font-medium focus-visible:ring-3 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            Mais filtros e ordenação
            <ChevronDown aria-hidden="true" className="size-4 transition-transform" />
          </summary>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Categoria
              <DesignSelect aria-label="Categoria" name="category" defaultValue={params.category ?? ""}>
                <option value="">Todas as categorias</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parent ? `${getCategoryLabel(category.parent)} / ` : ""}
                    {getCategoryLabel(category)}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Marca
              <DesignSelect aria-label="Marca" name="brand" defaultValue={params.brand ?? ""}>
                <option value="">Todas as marcas</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Loja
              <DesignSelect aria-label="Loja" name="seller" defaultValue={params.seller ?? ""}>
                <option value="">Todas as lojas</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.store?.name ?? "Sem loja"}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Ordenar
              <DesignSelect aria-label="Ordenar" name="sort" defaultValue={params.sort}>
                <option value="relevance">Mais relevantes</option>
                <option value="newest">Mais recentes</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Disponibilidade
              <DesignSelect aria-label="Disponibilidade" name="availability" defaultValue={params.availability}>
                <option value="ALL">Todos</option>
                <option value="IN_STOCK">Em estoque</option>
                <option value="OUT_OF_STOCK">Esgotados</option>
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Preço mínimo (R$)
              <PriceFilterInput name="minPrice" cents={params.minPrice} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Preço máximo (R$)
              <PriceFilterInput name="maxPrice" cents={params.maxPrice} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Oferta
              <DesignSelect aria-label="Oferta" name="promotion" defaultValue={params.promotion}>
                <option value="ALL">Todos os preços</option>
                <option value="ON_SALE">Em oferta</option>
              </DesignSelect>
            </label>
          </div>
          <Button type="submit" className="mt-4 rounded-md px-4">
            Aplicar filtros
          </Button>
        </details>
      </form>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{result.total} {result.total === 1 ? "produto" : "produtos"}</h2>
          {params.moto ||
          params.category ||
          params.brand ||
          params.seller ||
          params.q ||
          params.availability !== "ALL" ||
          params.minPrice !== null ||
          params.maxPrice !== null ||
          params.promotion !== "ALL" ? (
            <Link href="/products" className="text-muted-foreground text-sm underline underline-offset-4">
              Limpar filtros
            </Link>
          ) : null}
        </div>
        <ProductGrid
          products={result.products}
          emptyMessage={
            params.q ||
            params.moto ||
            params.category ||
            params.brand ||
            params.seller ||
            params.availability !== "ALL" ||
            params.minPrice !== null ||
            params.maxPrice !== null ||
            params.promotion !== "ALL"
              ? "Nenhum produto encontrado. Ajuste ou limpe os filtros para tentar novamente."
              : "Ainda não há produtos publicados no catálogo."
          }
        />
        {result.pageCount > 1 ? (
          <Pagination
            ariaLabel="Paginação de produtos"
            page={result.page}
            pageCount={result.pageCount}
            previousHref={pageHref(result.page - 1)}
            nextHref={pageHref(result.page + 1)}
            className="mt-6"
          />
        ) : null}
      </section>
    </main>
  );
}
