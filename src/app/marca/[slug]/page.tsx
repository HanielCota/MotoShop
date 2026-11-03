import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PublicCatalogLanding } from "@/modules/catalog/components/public-catalog-landing";
import { PublicCatalogLandingSkeleton } from "@/modules/catalog/components/public-catalog-skeletons";
import { getPublicBrandBySlug } from "@/modules/catalog/queries/public-catalog";
import { loadPublicCatalogSearchParams } from "@/modules/catalog/search-params";
import { listApprovedProducts } from "@/modules/products/queries/products";
import { listPublicVariantAttributeOptions } from "@/modules/products/queries/variant-attribute-options";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getPublicBrandBySlug(slug);
  if (!brand) return { title: "Marca não encontrada" };
  return {
    title: `Produtos ${brand.name}`,
    description: `Encontre produtos ${brand.name} para motocross no Moto Shop.`,
    alternates: { canonical: `/marca/${brand.slug}` },
  };
}

type CatalogSearchParams = Promise<Record<string, string | string[] | undefined>>;
type PublicBrand = NonNullable<Awaited<ReturnType<typeof getPublicBrandBySlug>>>;

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: CatalogSearchParams;
}) {
  const { slug } = await params;
  // Check existence before any Suspense: once streaming starts, the status has already gone out as 200.
  const brand = await getPublicBrandBySlug(slug);
  if (brand == null) notFound();

  return (
    <Suspense fallback={<PublicCatalogLandingSkeleton />}>
      <BrandLanding brand={brand} searchParams={searchParams} />
    </Suspense>
  );
}

async function BrandLanding({ brand, searchParams }: { brand: PublicBrand; searchParams: CatalogSearchParams }) {
  const catalogParams = await loadPublicCatalogSearchParams(searchParams);
  const attributes = { gender: catalogParams.gender, color: catalogParams.color, size: catalogParams.size };
  const attributeOptions = await listPublicVariantAttributeOptions();
  const result = await listApprovedProducts({
    brandId: brand.id,
    sort: catalogParams.sort,
    availability: catalogParams.availability,
    promotion: catalogParams.promotion,
    gender: catalogParams.gender,
    color: catalogParams.color,
    size: catalogParams.size,
    page: catalogParams.page,
    pageSize: 12,
  });

  return (
    <PublicCatalogLanding
      title={`Produtos ${brand.name}`}
      description={`Encontre produtos da marca ${brand.name} para sua próxima sessão de motocross.`}
      result={result}
      allProductsHref={`/products?brand=${brand.id}`}
      baseHref={`/marca/${brand.slug}`}
      page={result.page}
      sort={catalogParams.sort}
      availability={catalogParams.availability}
      promotion={catalogParams.promotion}
      attributes={attributes}
      attributeOptions={attributeOptions}
    />
  );
}
