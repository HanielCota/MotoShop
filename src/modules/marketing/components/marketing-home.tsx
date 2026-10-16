import Image from "next/image";

import { pageContainerClassName } from "@/components/ui/page-container";
import type { ProductCardData } from "@/components/storefront/product-card";
import type { FitmentOption } from "@/modules/motorcycles/domain/fitment-options";

import { BRAND_SLOGAN } from "@/config/brand";

import { CategoryShowcase, type MarketingCategory } from "./category-showcase";
import { EssentialsSection } from "./essentials-section";
import { FeaturedProducts } from "./featured-products";
import styles from "./marketing-home.module.css";
import { MotorcycleFinder } from "./motorcycle-finder";
import { SellerCta } from "./seller-cta";
import { HeroAssurances } from "./hero-assurances";

type MarketingHomeProps = {
  fitments: FitmentOption[];
  categories: MarketingCategory[];
  featuredProducts: ProductCardData[];
  primaryFitmentId?: string | null;
  /** Mesmo resultado que o checkout usa; falso enquanto o pagamento pelo marketplace não está liberado. */
  paymentAvailable: boolean;
};

// O slogan quebra antes da última palavra ("OFF-ROAD!"), mantendo a direção de arte do hero.
const sloganBreak = BRAND_SLOGAN.lastIndexOf(" ");
const sloganLead = BRAND_SLOGAN.slice(0, sloganBreak);
const sloganEnd = BRAND_SLOGAN.slice(sloganBreak + 1);

/**
 * Página inicial: composição de seções server-rendered; apenas o seletor de moto é client component.
 * Cabeçalho e rodapé vêm do layout raiz (StorefrontNavigation/SiteFooter).
 */
export function MarketingHome({
  fitments,
  categories,
  featuredProducts,
  primaryFitmentId,
  paymentAvailable,
}: MarketingHomeProps) {
  return (
    <main className="bg-surface-sunken flex flex-col overflow-x-clip">
      <section className="bg-moto-brand-foreground relative isolate text-white" aria-labelledby="home-title">
        <Image
          className={styles.heroImage}
          src="/2016_JS7_MEC_PR_JK14.jpg"
          alt="Piloto de motocross saltando com a moto em uma pista off-road"
          fill
          preload
          sizes="(min-width: 1024px) 56vw, 100vw"
        />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={pageContainerClassName("default", "pt-12 pb-12 sm:pt-20 sm:pb-16 lg:pt-24")}>
          <p className="eyebrow text-moto-brand-surface flex items-center gap-2.5">
            <span className={styles.kickerRule} aria-hidden="true" />
            Motopeças · Acessórios · Equipamentos
          </p>
          <h1
            id="home-title"
            className="mt-4 mb-4 max-w-5xl text-5xl leading-[0.88] tracking-[-0.04em] text-balance uppercase sm:text-7xl lg:max-w-3xl lg:text-8xl"
          >
            {sloganLead}
            <br />
            {sloganEnd}
          </h1>
          <p className="mb-7 max-w-xl text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
            Peças, acessórios e equipamentos de lojistas parceiros. Escolha a sua moto e veja as peças compatíveis.
          </p>
          <MotorcycleFinder fitments={fitments} primaryFitmentId={primaryFitmentId} />
          <HeroAssurances paymentAvailable={paymentAvailable} />
        </div>
      </section>

      {/* On phones the featured products come right after the finder (the categories took two screens
          before the first product); from md up the approved order stays. Sections are independent, so
          the visual swap does not change their meaning. */}
      <div className="order-2 md:order-1">
        <CategoryShowcase categories={categories} />
      </div>
      <div className="order-1 md:order-2">
        <FeaturedProducts products={featuredProducts} />
      </div>
      <div className="order-3">
        <EssentialsSection categories={categories} />
      </div>
      <div className="order-4">
        <SellerCta />
      </div>
    </main>
  );
}
