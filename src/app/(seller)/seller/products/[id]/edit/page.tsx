import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { InlineNotice } from "@/components/ui/inline-notice";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { listActiveMotorcycleFitmentsForProduct } from "@/modules/catalog/queries/admin-catalog";
import { ProductImageManager } from "@/modules/products/components/product-image-manager";
import { ProductEditForm } from "@/modules/products/components/product-edit-form";
import { ProductSubmissionAction } from "@/modules/products/components/product-submission-action";
import { listProductBrands, listProductCategories } from "@/modules/products/queries/products";
import { getSellerProductForEdit } from "@/modules/products/queries/seller-product-for-edit";
import { formatPromotionDate, getMeasurements } from "@/modules/products/domain/product-commercial-fields";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

export const metadata: Metadata = {
  title: "Editar produto · Central do Lojista",
  robots: { index: false, follow: false },
};

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  const [product, categories, brands, fitments] = await Promise.all([
    getSellerProductForEdit(context.seller.id, id),
    listProductCategories(),
    listProductBrands(),
    listActiveMotorcycleFitmentsForProduct(),
  ]);
  if (!product || product.variants.length === 0) notFound();

  return (
    <>
      <PageHeader
        back={{ href: "/seller/products", label: "Voltar para produtos" }}
        eyebrow="Catálogo"
        title="Editar produto"
        description="Confira os dados, adicione as fotos e envie o produto para aprovação ao final da página."
        actions={<StatusBadge domain="product" status={product.status} />}
      />
      {product.status === "REJECTED" && product.rejectionReason ? (
        <InlineNotice tone="error" role="note">
          <span className="font-semibold">Motivo da recusa:</span> {product.rejectionReason}
        </InlineNotice>
      ) : null}
      <Card>
        <CardContent>
          <ProductEditForm
            product={{
              id: product.id,
              revision: product.updatedAt.toISOString(),
              ...getMeasurements(product),
              name: product.name,
              slug: product.slug,
              description: product.description,
              categoryId: product.categoryId,
              brandId: product.brandId,
              variants: product.variants.map((variant) => ({
                id: variant.id,
                title: variant.title,
                sku: variant.sku,
                priceInCents: variant.priceInCents,
                ...getMeasurements(variant),
                promotionalPriceInCents: variant.promotionalPriceInCents,
                promotionStartsAt: formatPromotionDate(variant.promotionStartsAt),
                promotionEndsAt: formatPromotionDate(variant.promotionEndsAt),
                gender: variant.gender,
                color: variant.color,
                size: variant.size,
                stock: variant.inventory?.availableQuantity ?? 0,
              })),
              motorcycleFitmentIds: product.compatibilities.map((compatibility) => compatibility.motorcycleFitmentId),
            }}
            categories={categories}
            brands={brands}
            fitments={fitments.map((fitment) => ({
              id: fitment.id,
              label: `${fitment.motorcycleModel.manufacturer.name} ${fitment.motorcycleModel.name} · ${fitment.version || "padrão"} · ${fitment.year}`,
            }))}
          />
          <div className="mt-6">
            <ProductImageManager
              productId={product.id}
              initialImages={product.images.map((image) => ({
                id: image.id,
                storageKey: image.storageKey,
                altText: image.altText,
                url: getPublicStorageUrl(image.storageKey),
              }))}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="font-semibold">Enviar para análise</h2>
            <p className="text-muted-foreground text-sm">
              Salve as alterações antes de enviar. Depois do envio, o produto fica bloqueado para edição até a análise
              do Moto Shop.
            </p>
          </div>
          <ProductSubmissionAction productId={product.id} redirectTo="/seller/products" />
        </CardContent>
      </Card>
    </>
  );
}
