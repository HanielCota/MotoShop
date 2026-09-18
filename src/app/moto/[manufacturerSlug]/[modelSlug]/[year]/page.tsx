import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PublicCatalogLanding } from "@/modules/catalog/components/public-catalog-landing";
import { getPublicMotorcycleByYear } from "@/modules/catalog/queries/public-catalog";
import { loadPublicCatalogSearchParams } from "@/modules/catalog/search-params";
import { listApprovedProducts } from "@/modules/products/queries/products";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ manufacturerSlug: string; modelSlug: string; year: string }>;
}): Promise<Metadata> {
  const { manufacturerSlug, modelSlug, year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year)) return { title: "Moto não encontrada" };
  const motorcycle = await getPublicMotorcycleByYear(manufacturerSlug, modelSlug, year);
  if (!motorcycle) return { title: "Moto não encontrada" };
  const title = `${motorcycle.manufacturer.name} ${motorcycle.name} ${year}`;
  return {
    title,
    description: `Peças e equipamentos compatíveis com ${title} no MotoShop.`,
    alternates: { canonical: `/moto/${manufacturerSlug}/${modelSlug}/${year}` },
  };
}

export default async function MotorcyclePage({
  params,
  searchParams,
}: {
  params: Promise<{ manufacturerSlug: string; modelSlug: string; year: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { manufacturerSlug, modelSlug, year: yearParam } = await params;
  const catalogParams = await loadPublicCatalogSearchParams(searchParams);
  const year = Number(yearParam);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) notFound();

  const motorcycle = await getPublicMotorcycleByYear(manufacturerSlug, modelSlug, year);
  if (!motorcycle || motorcycle.fitments.length === 0) notFound();

  const fitmentIds = motorcycle.fitments.map((fitment) => fitment.id);
  const result = await listApprovedProducts({ motorcycleFitmentIds: fitmentIds, sort: catalogParams.sort, availability: catalogParams.availability, promotion: catalogParams.promotion, page: catalogParams.page, pageSize: 12 });
  const fitmentDetails = motorcycle.fitments
    .map((fitment) => `${fitment.version || "padrão"} · ${fitment.displacementCc}cc`)
    .join(", ");

  return (
    <PublicCatalogLanding
      title={`${motorcycle.manufacturer.name} ${motorcycle.name} ${year}`}
      description={`Peças e equipamentos compatíveis com ${motorcycle.manufacturer.name} ${motorcycle.name} ${year}. Configurações: ${fitmentDetails}.`}
      result={result}
      allProductsHref={`/products?moto=${fitmentIds[0]}`}
      baseHref={`/moto/${manufacturerSlug}/${modelSlug}/${year}`}
      page={result.page}
      sort={catalogParams.sort}
      availability={catalogParams.availability}
      promotion={catalogParams.promotion}
    />
  );
}
