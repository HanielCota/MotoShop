import Image from "next/image";
import { PackageSearch } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { InlineNotice } from "@/components/ui/inline-notice";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatMoneyInCents, formatCount } from "@/lib/format";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { getAdminCatalogData } from "@/modules/catalog/queries/admin-catalog";
import { ProductStatusActions } from "@/modules/products/components/product-status-actions";
import { listProductReviewQueue } from "@/modules/products/queries/products";
import { listSellerOptionsForAdmin } from "@/modules/sellers/queries/sellers";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

import { adminHref } from "../../admin-href";
import { loadAdminProductReviewSearchParams } from "../../search-params";
import {
  AdminCard,
  AdminFilterForm,
  AdminList,
  FilterDateRange,
  FilterSelect,
  FilterText,
  oldestFirstSortOptions,
  sellerFilterOptions,
} from "../admin-ui";
import type { AdminSectionProps } from "./types";

const reviewStatusOptions = [
  { value: "SUBMITTED", label: "Aguardando aprovação" },
  { value: "REJECTED", label: "Recusados" },
  { value: "ALL", label: "Todos" },
];
const GALLERY_SIZE = 4;

export async function AdminProductsSection({ searchParams }: AdminSectionProps) {
  const params = await loadAdminProductReviewSearchParams(searchParams);
  const [result, catalog, sellerOptions] = await Promise.all([
    listProductReviewQueue({
      status: params.productReviewStatus,
      q: params.productReviewQ,
      categoryId: params.productReviewCategoryId,
      brandId: params.productReviewBrandId,
      sellerId: params.productReviewSellerId,
      from: params.productReviewFrom,
      to: params.productReviewTo,
      sort: params.productReviewSort,
      page: params.productReviewPage,
    }),
    getAdminCatalogData(),
    listSellerOptionsForAdmin(),
  ]);
  const pageHref = (page: number) =>
    adminHref(
      "products",
      { ...params, productReviewPage: page },
      { productReviewSort: "oldest", productReviewStatus: "SUBMITTED" },
    );

  const categoryOptions = [
    { value: "", label: "Todas" },
    ...catalog.categories.map((category) => ({
      value: category.id,
      label: category.parent
        ? `${getCategoryLabel(category.parent)} / ${getCategoryLabel(category)}`
        : getCategoryLabel(category),
    })),
  ];
  const brandOptions = [
    { value: "", label: "Todas" },
    ...catalog.brands.map((brand) => ({ value: brand.id, label: brand.name })),
  ];

  return (
    <AdminCard
      id="admin-products"
      title="Produtos aguardando revisão"
      description="Produtos enviados pelos lojistas para publicação."
    >
      <AdminFilterForm resetHref={adminHref("products", {})} label="Filtrar produtos">
        <FilterText
          label="Buscar produto"
          name="productReviewQ"
          value={params.productReviewQ}
          placeholder="Nome, SKU ou loja"
        />
        <FilterSelect
          label="Status da revisão"
          name="productReviewStatus"
          value={params.productReviewStatus}
          options={reviewStatusOptions}
        />
        <FilterSelect
          label="Categoria"
          name="productReviewCategoryId"
          value={params.productReviewCategoryId ?? ""}
          options={categoryOptions}
        />
        <FilterSelect
          label="Marca"
          name="productReviewBrandId"
          value={params.productReviewBrandId ?? ""}
          options={brandOptions}
        />
        <FilterSelect
          label="Lojista"
          name="productReviewSellerId"
          value={params.productReviewSellerId ?? ""}
          options={sellerFilterOptions(sellerOptions)}
        />
        <FilterDateRange
          fromName="productReviewFrom"
          toName="productReviewTo"
          from={params.productReviewFrom}
          to={params.productReviewTo}
        />
        <FilterSelect
          label="Ordenação"
          name="productReviewSort"
          value={params.productReviewSort}
          options={oldestFirstSortOptions}
        />
      </AdminFilterForm>
      {result.products.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nenhum produto aguardando revisão"
          description="Quando um lojista enviar um produto para aprovação, ele aparecerá aqui."
        />
      ) : (
        <AdminList label="Produtos em revisão">
          {result.products.map((product) => {
            const imageCount = product._count.images;
            return (
              <li key={product.id} data-testid={`product-review-${product.id}`} className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <ProductReviewGallery product={product} imageCount={imageCount} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold break-words">{product.name}</h3>
                      <StatusBadge domain="product" status={product.status} />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {product.seller.store?.name ?? "Lojista"} · {product.brand.name} ·{" "}
                      {getCategoryLabel(product.category)} · atualizado em {formatDate(product.updatedAt)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm break-words">{product.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.variants
                        .filter((variant) => variant.active)
                        .map((variant) => (
                          <span key={variant.id} className="bg-surface-sunken rounded-md border px-2 py-1 text-xs">
                            {variant.title} · {variant.sku} · {formatMoneyInCents(variant.priceInCents)} · estoque{" "}
                            {variant.inventory?.availableQuantity ?? 0}
                          </span>
                        ))}
                    </div>
                    {product.compatibilities.length > 0 ? (
                      <p className="text-muted-foreground mt-2 text-xs">
                        Compatível com:{" "}
                        {product.compatibilities
                          .map(
                            ({ motorcycleFitment: fitment }) =>
                              `${fitment.motorcycleModel.manufacturer.name} ${fitment.motorcycleModel.name} ${fitment.year}`,
                          )
                          .join(", ")}
                      </p>
                    ) : null}
                  </div>
                </div>
                {product.status === "SUBMITTED" && imageCount === 0 ? (
                  <InlineNotice tone="warning">
                    Este produto não tem fotos. Ele aparecerá sem imagem na loja.
                  </InlineNotice>
                ) : null}
                {product.status === "SUBMITTED" ? (
                  <ProductStatusActions productId={product.id} hasImages={imageCount > 0} />
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Motivo da recusa: {product.rejectionReason ?? "Não informado"}
                  </p>
                )}
              </li>
            );
          })}
        </AdminList>
      )}
      {result.pageCount > 1 ? (
        <Pagination
          ariaLabel="Paginação da fila de produtos"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
          summary={<>{formatCount(result.total, "produto", "produtos")}</>}
        />
      ) : null}
    </AdminCard>
  );
}

type ReviewQueueProduct = Awaited<ReturnType<typeof listProductReviewQueue>>["products"][number];

/** Até quatro fotos na ordem da galeria; a primeira é a capa pública. */
function ProductReviewGallery({ product, imageCount }: { product: ReviewQueueProduct; imageCount: number }) {
  if (imageCount === 0) {
    return (
      <div className="bg-muted flex aspect-square w-full shrink-0 items-center justify-center rounded-md border sm:w-28">
        <span className="text-muted-foreground px-2 text-center text-xs">Sem fotos</span>
      </div>
    );
  }

  const hiddenCount = imageCount - Math.min(product.images.length, GALLERY_SIZE);
  return (
    <ul aria-label={`Fotos de ${product.name}`} className="grid w-full shrink-0 grid-cols-4 gap-1 sm:w-56">
      {product.images.slice(0, GALLERY_SIZE).map((image, index) => {
        const imageUrl = getPublicStorageUrl(image.storageKey);
        const isLast = index === GALLERY_SIZE - 1 && hiddenCount > 0;
        return (
          <li key={image.id} className="bg-muted relative aspect-square overflow-hidden rounded-md border">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={image.altText ?? product.name}
                width={112}
                height={112}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : null}
            {isLast ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">
                +{hiddenCount}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
