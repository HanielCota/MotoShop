import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PublicCatalogLanding } from "@/modules/catalog/components/public-catalog-landing";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { getPublicCategoryBySlug } from "@/modules/catalog/queries/public-catalog";
import { loadPublicCatalogSearchParams } from "@/modules/catalog/search-params";
import { listApprovedProducts } from "@/modules/products/queries/products";

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

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const catalogParams = await loadPublicCatalogSearchParams(searchParams);
  const category = await getPublicCategoryBySlug(slug);
  if (!category) notFound();

  const result = await listApprovedProducts({
    categoryId: category.id,
    sort: catalogParams.sort,
    availability: catalogParams.availability,
    promotion: catalogParams.promotion,
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
    />
  );
}
