import type { Metadata } from "next";
import { connection } from "next/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { MarketingHome } from "@/modules/marketing/components/marketing-home";
import { listActiveMotorcycleFitments } from "@/modules/motorcycles/queries/motorcycles";
import { listMarketingCategories } from "@/modules/marketing/queries/marketing-categories";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getPrimarySavedMotorcycle } from "@/modules/motorcycles/queries/saved-motorcycles";
import { listFeaturedProducts } from "@/modules/marketing/queries/featured-products";

export const metadata: Metadata = {
  title: "O Marketplace de quem vive o OFF-ROAD!",
  description:
    "O Moto Shop Brasil é uma plataforma e-commerce no formato de marketplace voltada para o setor de motopeças, acessórios e equipamentos, com destaque para o segmento off-road. A plataforma atua como ponte tecnológica entre clientes finais e lojistas parceiros.",
};

export default async function HomePage() {
  await connection();
  const [fitments, categories, session, featuredProducts] = await Promise.all([
    listActiveMotorcycleFitments(),
    listMarketingCategories(),
    getCurrentSession(),
    listFeaturedProducts(),
  ]);
  const primaryMotorcycle = session ? await getPrimarySavedMotorcycle(session.user.id) : null;

  return (
    <div>
      <NuqsAdapter>
        <MarketingHome
          categories={categories}
          featuredProducts={featuredProducts}
          primaryFitmentId={primaryMotorcycle?.motorcycleFitmentId ?? null}
          fitments={fitments.map((fitment) => ({
            id: fitment.id,
            manufacturer: fitment.motorcycleModel.manufacturer.name,
            model: fitment.motorcycleModel.name,
            version: fitment.version,
            displacementCc: fitment.displacementCc,
            year: fitment.year,
          }))}
        />
      </NuqsAdapter>
    </div>
  );
}
