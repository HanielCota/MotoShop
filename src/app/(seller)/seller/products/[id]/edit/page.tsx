import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/database";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { listActiveMotorcycleFitmentsForProduct } from "@/modules/catalog/queries/admin-catalog";
import { ProductImageManager } from "@/modules/products/components/product-image-manager";
import { ProductEditForm } from "@/modules/products/components/product-edit-form";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  const [product, categories, brands, fitments] = await Promise.all([
    db.product.findFirst({
      where: { id, sellerId: context.seller.id, status: { in: ["DRAFT", "REJECTED"] } },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { where: { active: true }, include: { inventory: true }, orderBy: { createdAt: "asc" } },
        compatibilities: { select: { motorcycleFitmentId: true } },
      },
    }),
    db.category.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.brand.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    listActiveMotorcycleFitmentsForProduct(),
  ]);
  if (!product || product.variants.length === 0) notFound();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar produto</CardTitle>
        <CardDescription>Atualize o rascunho antes de enviá-lo para revisão.</CardDescription>
      </CardHeader>
      <CardContent>
        <ProductEditForm
          product={{
            id: product.id,
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
  );
}
