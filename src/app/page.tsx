import type { Metadata } from "next";
import { connection } from "next/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { BRAND_DESCRIPTION, BRAND_SLOGAN } from "@/config/brand";
import { MarketingHome } from "@/modules/marketing/components/marketing-home";
import { listActiveMotorcycleFitments } from "@/modules/motorcycles/queries/motorcycles";
import { listMarketingCategories } from "@/modules/marketing/queries/marketing-categories";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getPrimarySavedMotorcycle } from "@/modules/motorcycles/queries/saved-motorcycles";
import { listFeaturedProducts } from "@/modules/marketing/queries/featured-products";
import { getCheckoutPaymentAvailability } from "@/modules/payments/application/assert-payment-ready";

// Home: a aba mostra apenas o slogan (sem o sufixo "| O Moto Shop" do template).
export const metadata: Metadata = {
  title: { absolute: BRAND_SLOGAN },
  description: BRAND_DESCRIPTION,
  alternates: { canonical: "/" },
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
  // A single-store cart is the simplest purchase: if even that cannot be paid, no purchase can.
  const payment = getCheckoutPaymentAvailability(1);

  return (
    <div>
      <NuqsAdapter>
        <MarketingHome
          categories={categories}
          featuredProducts={featuredProducts}
          primaryFitmentId={primaryMotorcycle?.motorcycleFitmentId ?? null}
          paymentAvailable={payment.available}
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
