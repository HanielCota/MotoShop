import Link from "next/link";
import type { Route } from "next";

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
        className="grid min-w-0 gap-3 rounded-xl border p-4 md:grid-cols-2 [&_input]:min-w-0 [&_label]:min-w-0 [&_select]:w-full [&_select]:min-w-0"
      >
        <label className="flex flex-col gap-2 text-sm font-medium">
          Buscar
          <input
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Produto, SKU, marca ou loja..."
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Minha Moto
          <select
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            name="moto"
            defaultValue={params.moto ?? ""}
          >
            <option value="">Todas as motos</option>
            {fitments.map((fitment) => (
              <option key={fitment.id} value={fitment.id}>
                {fitment.motorcycleModel.manufacturer.name} {fitment.motorcycleModel.name} {fitment.version} ·{" "}
                {fitment.displacementCc} cc · {fitment.year}
              </option>
            ))}
          </select>
        </label>
        <button className="bg-primary text-primary-foreground hover:bg-primary/80 h-11 rounded-md px-4 text-sm font-medium md:w-fit">
          Aplicar busca
        </button>
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
          <summary className="cursor-pointer py-3 text-sm font-medium">Mais filtros e ordenação</summary>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Categoria
              <select
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                name="category"
                defaultValue={params.category ?? ""}
              >
                <option value="">Todas as categorias</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parent ? `${getCategoryLabel(category.parent)} / ` : ""}
                    {getCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Marca
              <select
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                name="brand"
                defaultValue={params.brand ?? ""}
              >
                <option value="">Todas as marcas</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Loja
              <select
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                name="seller"
                defaultValue={params.seller ?? ""}
              >
                <option value="">Todas as lojas</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.store?.name ?? "Sem loja"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Ordenar
              <select
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                name="sort"
                defaultValue={params.sort}
              >
                <option value="relevance">Mais relevantes</option>
                <option value="newest">Mais recentes</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Disponibilidade
              <select
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                name="availability"
                defaultValue={params.availability}
              >
                <option value="ALL">Todos</option>
                <option value="IN_STOCK">Em estoque</option>
                <option value="OUT_OF_STOCK">Esgotados</option>
              </select>
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
              <select
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                name="promotion"
                defaultValue={params.promotion}
              >
                <option value="ALL">Todos os preços</option>
                <option value="ON_SALE">Em oferta</option>
              </select>
            </label>
          </div>
          <button className="bg-primary text-primary-foreground hover:bg-primary/80 mt-4 h-10 rounded-md px-4 text-sm font-medium">
            Aplicar filtros
          </button>
        </details>
      </form>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{result.total} produto(s)</h2>
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
          <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Paginação de produtos">
            {result.page > 1 ? (
              <Link href={pageHref(result.page - 1)} className="rounded-md border px-3 py-2 text-sm">
                Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground text-sm">
              Página {result.page} de {result.pageCount}
            </span>
            {result.page < result.pageCount ? (
              <Link href={pageHref(result.page + 1)} className="rounded-md border px-3 py-2 text-sm">
                Próxima
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
