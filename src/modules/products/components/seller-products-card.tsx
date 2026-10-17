import Link from "next/link";
import type { Route } from "next";
import { Package } from "lucide-react";

import { Disclosure } from "@/components/ui/disclosure";
import { ActionForm } from "@/components/ui/action-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterField, FilterForm, FilterSelect, FilterText } from "@/components/ui/filter-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoneyInCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { archiveProductAction, restoreProductAction } from "@/modules/products/actions/product-actions";
import { InventoryAdjustDialog } from "@/modules/products/components/inventory-adjust-dialog";
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
const productStatusOptions = [{ value: "ALL", label: "Todos" }, ...getStatusOptions("product")];
const productStockOptions = [
  { value: "ALL", label: "Todos" },
  { value: "IN", label: "Em estoque" },
  { value: "LOW", label: "Baixo (1–5)" },
  { value: "OUT", label: "Esgotado" },
];
const productPromotionOptions = [
  { value: "ALL", label: "Todas" },
  { value: "ON_SALE", label: "Em promoção" },
];
const productSortOptions = [
  { value: "updated_newest", label: "Atualizados recentemente" },
  { value: "updated_oldest", label: "Atualizados há mais tempo" },
  { value: "name_asc", label: "Nome A–Z" },
  { value: "name_desc", label: "Nome Z–A" },
];

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
        <CardTitle>Catálogo</CardTitle>
        <CardDescription>
          {result.total} {result.total === 1 ? "produto encontrado" : "produtos encontrados"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Disclosure variant="section" summary="Filtros de produtos" defaultOpen={hasFilters} className="mb-4">
          <FilterForm resetHref={basePath} action={basePath} label="Filtrar produtos">
            <FilterText
              label="Buscar produto"
              name="productQ"
              value={params.productQ}
              placeholder="Nome, slug ou SKU"
            />
            <FilterSelect
              label="Categoria"
              name="productCategory"
              value={params.productCategory ?? ""}
              options={[
                { value: "", label: "Todas" },
                ...categories.map((category) => ({
                  value: category.id,
                  label: `${category.parent ? `${getCategoryLabel(category.parent)} / ` : ""}${getCategoryLabel(category)}`,
                })),
              ]}
            />
            <FilterSelect
              label="Marca"
              name="productBrand"
              value={params.productBrand ?? ""}
              options={[
                { value: "", label: "Todas" },
                ...brands.map((brand) => ({ value: brand.id, label: brand.name })),
              ]}
            />
            <FilterField label="Preço mín. (R$)">
              <Input
                size="sm"
                name="productMinPrice"
                inputMode="decimal"
                autoComplete="off"
                defaultValue={formatOptionalPrice(params.productMinPrice)}
                placeholder="Ex.: 50,00"
              />
            </FilterField>
            <FilterField label="Preço máx. (R$)">
              <Input
                size="sm"
                name="productMaxPrice"
                inputMode="decimal"
                autoComplete="off"
                defaultValue={formatOptionalPrice(params.productMaxPrice)}
                placeholder="Ex.: 1000,00"
              />
            </FilterField>
            <FilterSelect
              label="Status"
              name="productStatus"
              value={params.productStatus}
              options={productStatusOptions}
            />
            <FilterSelect
              label="Estoque"
              name="productStock"
              value={params.productStock}
              options={productStockOptions}
            />
            <FilterSelect
              label="Promoção"
              name="productPromotion"
              value={params.productPromotion}
              options={productPromotionOptions}
            />
            <FilterSelect
              label="Ordenação"
              name="productSort"
              value={params.productSort}
              options={productSortOptions}
            />
          </FilterForm>
        </Disclosure>
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
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground mt-2 text-xs">Sem variações cadastradas.</p>
                    )}
                    {product.rejectionReason ? (
                      <p className="text-destructive mt-1 text-xs">Motivo da recusa: {product.rejectionReason}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.length > 0 ? (
                      <InventoryAdjustDialog
                        productName={product.name}
                        variants={product.variants.map((variant) => ({
                          id: variant.id,
                          title: variant.title,
                          sku: variant.sku,
                          availableQuantity: variant.inventory?.availableQuantity ?? 0,
                        }))}
                      />
                    ) : null}
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
                      <ActionForm action={restoreProductAction.bind(null, product.id)}>
                        <Button type="submit" size="sm">
                          Restaurar
                        </Button>
                      </ActionForm>
                    ) : null}
                    {editable ? <ProductSubmissionAction productId={product.id} /> : null}
                    {editable ? (
                      <ActionForm action={archiveProductAction.bind(null, product.id)}>
                        <Button type="submit" size="sm" variant="ghost">
                          Arquivar
                        </Button>
                      </ActionForm>
                    ) : null}
                    {product.status === "APPROVED" ? (
                      // Publicado só sai da vitrine com confirmação: para voltar, passa de novo pela aprovação (BUG-006).
                      <ConfirmDialog
                        trigger={
                          <Button type="button" size="sm" variant="ghost">
                            Arquivar
                          </Button>
                        }
                        title={`Arquivar ${product.name}?`}
                        description="Arquivar tira o produto da vitrine. Para voltar, ele volta como rascunho e passa de novo pela aprovação."
                        confirmLabel="Arquivar produto"
                        tone="destructive"
                        onConfirm={archiveProductAction.bind(null, product.id)}
                      />
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
