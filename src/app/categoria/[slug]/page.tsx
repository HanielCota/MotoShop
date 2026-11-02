import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PublicCatalogLanding } from "@/modules/catalog/components/public-catalog-landing";
import { PublicCatalogLandingSkeleton } from "@/modules/catalog/components/public-catalog-skeletons";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { getPublicCategoryBySlug } from "@/modules/catalog/queries/public-catalog";
import { loadPublicCatalogSearchParams } from "@/modules/catalog/search-params";
import { listApprovedProducts } from "@/modules/products/queries/products";
import { listPublicVariantAttributeOptions } from "@/modules/products/queries/variant-attribute-options";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getPublicCategoryBySlug(slug);
  if (!category) return { title: "Categoria não encontrada" };
  const categoryLabel = getCategoryLabel(category);
  return {
    title: categoryLabel,
    description: `Produtos de ${categoryLabel} para motocross no Moto Shop.`,
    alternates: { canonical: `/categoria/${category.slug}` },
  };
}

type CatalogSearchParams = Promise<Record<string, string | string[] | undefined>>;
type PublicCategory = NonNullable<Awaited<ReturnType<typeof getPublicCategoryBySlug>>>;

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: CatalogSearchParams;
}) {
  const { slug } = await params;
  // Check existence before any Suspense: once streaming starts, the status has already gone out as 200.
  const category = await getPublicCategoryBySlug(slug);
  if (category == null) notFound();

  return (
    <Suspense fallback={<PublicCatalogLandingSkeleton />}>
      <CategoryLanding category={category} searchParams={searchParams} />
    </Suspense>
  );
}

async function CategoryLanding({
  category,
  searchParams,
}: {
  category: PublicCategory;
  searchParams: CatalogSearchParams;
}) {
  const catalogParams = await loadPublicCatalogSearchParams(searchParams);
  const attributes = { gender: catalogParams.gender, color: catalogParams.color, size: catalogParams.size };
  const attributeOptions = await listPublicVariantAttributeOptions();
  const result = await listApprovedProducts({
    categoryId: category.id,
    sort: catalogParams.sort,
    availability: catalogParams.availability,
    promotion: catalogParams.promotion,
    gender: catalogParams.gender,
    color: catalogParams.color,
    size: catalogParams.size,
    page: catalogParams.page,
    pageSize: 12,
  });
  const categoryLabel = getCategoryLabel(category);
  const parentLabel = category.parent ? `${getCategoryLabel(category.parent)} / ` : "";

  return (
    <PublicCatalogLanding
      title={`${parentLabel}${categoryLabel}`}
      description={`Produtos de ${categoryLabel} aprovados pelo Moto Shop, com estoque e lojas verificadas.`}
      result={result}
      allProductsHref={`/products?category=${category.id}`}
      baseHref={`/categoria/${category.slug}`}
      page={result.page}
      sort={catalogParams.sort}
      availability={catalogParams.availability}
      promotion={catalogParams.promotion}
      attributes={attributes}
      attributeOptions={attributeOptions}
    />
  );
}
