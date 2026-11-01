import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PublicCatalogLanding } from "@/modules/catalog/components/public-catalog-landing";
import { PublicCatalogLandingSkeleton } from "@/modules/catalog/components/public-catalog-skeletons";
import { getPublicMotorcycleByYear } from "@/modules/catalog/queries/public-catalog";
import { loadPublicCatalogSearchParams } from "@/modules/catalog/search-params";
import { listApprovedProducts } from "@/modules/products/queries/products";
import { listPublicVariantAttributeOptions } from "@/modules/products/queries/variant-attribute-options";

/** Only canonical four-digit years reach the database (`99999999999999999999` overflowed the INT column). */
function parseMotorcycleYear(value: string) {
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 1900 && year <= 2100 ? year : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ manufacturerSlug: string; modelSlug: string; year: string }>;
}): Promise<Metadata> {
  const { manufacturerSlug, modelSlug, year: yearParam } = await params;
  const year = parseMotorcycleYear(yearParam);
  if (year === null) return { title: "Moto não encontrada" };
  const motorcycle = await getPublicMotorcycleByYear(manufacturerSlug, modelSlug, year);
  if (!motorcycle) return { title: "Moto não encontrada" };
  const title = `${motorcycle.manufacturer.name} ${motorcycle.name} ${year}`;
  return {
    title,
    description: `Peças e equipamentos compatíveis com ${title} no Moto Shop.`,
    alternates: { canonical: `/moto/${manufacturerSlug}/${modelSlug}/${year}` },
  };
}

type CatalogSearchParams = Promise<Record<string, string | string[] | undefined>>;
type PublicMotorcycle = NonNullable<Awaited<ReturnType<typeof getPublicMotorcycleByYear>>>;

export default async function MotorcyclePage({
  params,
  searchParams,
}: {
  params: Promise<{ manufacturerSlug: string; modelSlug: string; year: string }>;
  searchParams: CatalogSearchParams;
}) {
  const { manufacturerSlug, modelSlug, year: yearParam } = await params;
  const year = parseMotorcycleYear(yearParam);
  if (year === null) notFound();

  // Check existence before any Suspense: once streaming starts, the status has already gone out as 200.
  const motorcycle = await getPublicMotorcycleByYear(manufacturerSlug, modelSlug, year);
  if (motorcycle == null || motorcycle.fitments.length === 0) notFound();

  return (
    <Suspense fallback={<PublicCatalogLandingSkeleton />}>
      <MotorcycleLanding
        motorcycle={motorcycle}
        year={year}
        baseHref={`/moto/${manufacturerSlug}/${modelSlug}/${year}`}
        searchParams={searchParams}
      />
    </Suspense>
  );
}

async function MotorcycleLanding({
  motorcycle,
  year,
  baseHref,
  searchParams,
}: {
  motorcycle: PublicMotorcycle;
  year: number;
  baseHref: string;
  searchParams: CatalogSearchParams;
}) {
  const catalogParams = await loadPublicCatalogSearchParams(searchParams);
  const fitmentIds = motorcycle.fitments.map((fitment) => fitment.id);
  const attributes = { gender: catalogParams.gender, color: catalogParams.color, size: catalogParams.size };
  const attributeOptions = await listPublicVariantAttributeOptions();
  const result = await listApprovedProducts({
    motorcycleFitmentIds: fitmentIds,
    sort: catalogParams.sort,
    availability: catalogParams.availability,
    promotion: catalogParams.promotion,
    gender: catalogParams.gender,
    color: catalogParams.color,
    size: catalogParams.size,
    page: catalogParams.page,
    pageSize: 12,
  });
  const fitmentDetails = motorcycle.fitments
    .map((fitment) => `${fitment.version || "padrão"} · ${fitment.displacementCc}cc`)
    .join(", ");

  return (
    <PublicCatalogLanding
      title={`${motorcycle.manufacturer.name} ${motorcycle.name} ${year}`}
      description={`Peças e equipamentos compatíveis com ${motorcycle.manufacturer.name} ${motorcycle.name} ${year}. Configurações: ${fitmentDetails}.`}
      result={result}
      allProductsHref={`/products?moto=${fitmentIds[0]}`}
      baseHref={baseHref}
      page={result.page}
      sort={catalogParams.sort}
      availability={catalogParams.availability}
      promotion={catalogParams.promotion}
      attributes={attributes}
      attributeOptions={attributeOptions}
    />
  );
}
