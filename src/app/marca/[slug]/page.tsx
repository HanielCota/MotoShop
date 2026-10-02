import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PublicCatalogLanding } from "@/modules/catalog/components/public-catalog-landing";
import { getPublicBrandBySlug } from "@/modules/catalog/queries/public-catalog";
import { loadPublicCatalogSearchParams } from "@/modules/catalog/search-params";
import { listApprovedProducts } from "@/modules/products/queries/products";

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

export default async function BrandPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const catalogParams = await loadPublicCatalogSearchParams(searchParams);
  const brand = await getPublicBrandBySlug(slug);
  if (!brand) notFound();

  const result = await listApprovedProducts({ brandId: brand.id, sort: catalogParams.sort, availability: catalogParams.availability, promotion: catalogParams.promotion, page: catalogParams.page, pageSize: 12 });

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
    />
  );
}
