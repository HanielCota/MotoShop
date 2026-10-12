import Link from "next/link";
import type { Route } from "next";
import { Package } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DesignSelect } from "@/components/ui/design-select";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoneyInCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { archiveProductAction, restoreProductAction } from "@/modules/products/actions/product-actions";
import { InventoryAdjustForm } from "@/modules/products/components/inventory-adjust-form";
import { formatPriceInputFromCents } from "@/modules/products/domain/price-input";
import { ProductSubmissionAction } from "@/modules/products/components/product-submission-action";
import { listProductBrands, listProductCategories, listSellerProducts } from "@/modules/products/queries/products";
import {
  loadSellerProductSearchParams,
  serializeSellerProductSearchParams,
} from "@/modules/products/seller-search-params";
import { getStatusOptions } from "@/shared/presentation/status-labels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const basePath = "/seller/products";

export async function SellerProductsCard({
  sellerId,
  searchParams,
  canCreateProduct,
}: {
  sellerId: string;
  searchParams: SearchParams;
  canCreateProduct: boolean;
}) {
  const params = await loadSellerProductSearchParams(searchParams);
  const [result, categories, brands] = await Promise.all([
    listSellerProducts(sellerId, {
      query: params.productQ,
      categoryId: params.productCategory,
      brandId: params.productBrand,
      minPriceInCents: params.productMinPrice,
      maxPriceInCents: params.productMaxPrice,
      status: params.productStatus,
      stock: params.productStock,
      promotion: params.productPromotion,
      sort: params.productSort,
      page: params.productPage,
    }),
    listProductCategories(),
    listProductBrands(),
  ]);
  const hasFilters = Boolean(
    params.productQ ||
    params.productCategory ||
    params.productBrand ||
    params.productMinPrice !== null ||
    params.productMaxPrice !== null ||
    params.productStatus !== "ALL" ||
    params.productStock !== "ALL" ||
    params.productPromotion !== "ALL",
  );
  const pageHref = (page: number) =>
    serializeSellerProductSearchParams(basePath, { ...params, productPage: page }) as Route;

  return (
    <Card id="seller-products" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Catálogo</h2>
        </CardTitle>
        <CardDescription>
          {result.total} {result.total === 1 ? "produto encontrado" : "produtos encontrados"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <details className="mb-4 rounded-lg border p-3" open={hasFilters}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold [&::-webkit-details-marker]:hidden">
            Filtros de produtos
          </summary>
          <form className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get" action={basePath}>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Buscar produto
              <Input name="productQ" defaultValue={params.productQ ?? ""} placeholder="Nome, slug ou SKU" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Categoria
              <DesignSelect aria-label="Categoria" name="productCategory" defaultValue={params.productCategory ?? ""}>
                <option value="">Todas</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parent ? `${getCategoryLabel(category.parent)} / ` : ""}
                    {getCategoryLabel(category)}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Marca
              <DesignSelect aria-label="Marca" name="productBrand" defaultValue={params.productBrand ?? ""}>
                <option value="">Todas</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Preço mín. (R$)
              <Input
                name="productMinPrice"
                inputMode="decimal"
                autoComplete="off"
                defaultValue={formatOptionalPrice(params.productMinPrice)}
                placeholder="Ex.: 50,00"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Preço máx. (R$)
              <Input
                name="productMaxPrice"
                inputMode="decimal"
                autoComplete="off"
                defaultValue={formatOptionalPrice(params.productMaxPrice)}
                placeholder="Ex.: 1000,00"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status
              <DesignSelect aria-label="Status" name="productStatus" defaultValue={params.productStatus}>
                <option value="ALL">Todos</option>
                {getStatusOptions("product").map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Estoque
              <DesignSelect aria-label="Estoque" name="productStock" defaultValue={params.productStock}>
                <option value="ALL">Todos</option>
                <option value="IN">Em estoque</option>
                <option value="LOW">Baixo (1–5)</option>
                <option value="OUT">Esgotado</option>
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Promoção
              <DesignSelect aria-label="Promoção" name="productPromotion" defaultValue={params.productPromotion}>
                <option value="ALL">Todas</option>
                <option value="ON_SALE">Em promoção</option>
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ordenação
              <DesignSelect aria-label="Ordenação" name="productSort" defaultValue={params.productSort}>
                <option value="updated_newest">Atualizados recentemente</option>
                <option value="updated_oldest">Atualizados há mais tempo</option>
                <option value="name_asc">Nome A–Z</option>
                <option value="name_desc">Nome Z–A</option>
              </DesignSelect>
            </label>
            <Button type="submit" className="self-end">
              Filtrar
            </Button>
          </form>
        </details>
        {result.products.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={Package}
            title={hasFilters ? "Nenhum produto encontrado" : "Ainda não há produtos"}
            description={
              hasFilters
                ? "Ajuste ou limpe os filtros para ver outros produtos."
                : "Comece criando seu primeiro rascunho."
            }
            action={
              hasFilters
                ? { label: "Limpar filtros", href: basePath }
                : canCreateProduct
                  ? { label: "Novo produto", href: "/seller/products/new" }
                  : undefined
            }
          />
        ) : (
          <ul className="divide-border divide-y">
            {result.products.map((product) => {
              const editable = product.status === "DRAFT" || product.status === "REJECTED";
              return (
                <li key={product.id} className="flex flex-col gap-4 py-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base">{product.name}</h3>
                      <StatusBadge domain="product" status={product.status} />
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {product.brand.name} · {getCategoryLabel(product.category)} · {product.variants.length}{" "}
                      {product.variants.length === 1 ? "variação" : "variações"}
                    </p>
                    {product.variants.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {product.variants.map((variant) => (
                          <div key={variant.id} className="rounded-md border border-dashed p-2 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">
                                {variant.title} · {variant.sku}
                              </span>
                              <span className="tabular-nums">
                                {formatMoneyInCents(variant.priceInCents)} · estoque{" "}
                                {variant.inventory?.availableQuantity ?? 0}
                              </span>
                            </div>
                            <InventoryAdjustForm variantId={variant.id} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground mt-2 text-xs">Sem variações cadastradas.</p>
                    )}
                    {product.rejectionReason ? (
                      <p className="text-destructive mt-1 text-xs">Motivo da rejeição: {product.rejectionReason}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.status === "APPROVED" ? (
                      <Link
                        href={`/products/${product.slug}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Ver página
                      </Link>
                    ) : null}
                    {editable ? (
                      <Link
                        href={`/seller/products/${product.id}/edit`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Editar
                      </Link>
                    ) : null}
                    {product.status === "ARCHIVED" ? (
                      <form action={restoreProductAction.bind(null, product.id)}>
                        <Button type="submit" size="sm">
                          Restaurar
                        </Button>
                      </form>
                    ) : null}
                    {editable ? <ProductSubmissionAction productId={product.id} /> : null}
                    {editable ? (
                      <form action={archiveProductAction.bind(null, product.id)}>
                        <Button type="submit" size="sm" variant="ghost">
                          Arquivar
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination
          ariaLabel="Paginação de produtos da loja"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
          className="mt-5"
        />
      </CardContent>
    </Card>
  );
}

function formatOptionalPrice(cents: number | null) {
  if (cents === null) return "";
  return formatPriceInputFromCents(cents);
}
