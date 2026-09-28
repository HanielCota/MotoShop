import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import { connection } from "next/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { MarketingHome } from "@/modules/marketing/components/marketing-home";
import { listActiveMotorcycleFitments } from "@/modules/motorcycles/queries/motorcycles";
import { listMarketingCategories } from "@/modules/marketing/queries/marketing-categories";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getPrimarySavedMotorcycle } from "@/modules/motorcycles/queries/saved-motorcycles";
import { listFeaturedProducts } from "@/modules/marketing/queries/featured-products";

export const metadata: Metadata = {
  title: "Moto Shop | O marketplace de quem vive motocross",
  description:
    "Encontre peças, equipamentos e acessórios para motocross em lojas especializadas, com busca por compatibilidade com a sua moto.",
};

const marketingDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-marketing-display",
});

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
    <div className={marketingDisplay.variable}>
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
