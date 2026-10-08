import Image from "next/image";

import type { ProductCardData } from "@/components/storefront/product-card";
import type { FitmentOption } from "@/modules/motorcycles/domain/fitment-options";

import { CategoryShowcase, type MarketingCategory } from "./category-showcase";
import { EssentialsSection } from "./essentials-section";
import { FeaturedProducts } from "./featured-products";
import styles from "./marketing-home.module.css";
import { MotorcycleFinder } from "./motorcycle-finder";
import { SellerCta } from "./seller-cta";
import { TrustStrip } from "./trust-strip";

type MarketingHomeProps = {
  fitments: FitmentOption[];
  categories: MarketingCategory[];
  featuredProducts: ProductCardData[];
  primaryFitmentId?: string | null;
};

/**
 * Página inicial: composição de seções server-rendered; apenas o seletor de moto é client component.
 * Cabeçalho e rodapé vêm do layout raiz (StorefrontNavigation/SiteFooter).
 */
export function MarketingHome({ fitments, categories, featuredProducts, primaryFitmentId }: MarketingHomeProps) {
  return (
    <main className="bg-surface-sunken overflow-x-clip">
      <section className="relative isolate text-white" aria-labelledby="home-title">
        <Image
          className={styles.heroImage}
          src="/2016_JS7_MEC_PR_JK14.jpg"
          alt="Piloto de motocross saltando com a moto em uma pista off-road"
          fill
          preload
          sizes="100vw"
        />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className="mx-auto w-full max-w-6xl px-4 pt-12 pb-24 sm:px-6 sm:pt-20 sm:pb-28 lg:pt-24">
          <p className="text-moto-brand-surface flex items-center gap-2.5 text-xs font-bold tracking-[0.16em] uppercase">
            <span className={styles.kickerRule} aria-hidden="true" />
            Motopeças · Acessórios · Equipamentos
          </p>
          <h1
            id="home-title"
            className="mt-4 mb-4 max-w-5xl text-5xl leading-[0.88] tracking-[-0.04em] text-balance uppercase sm:text-7xl lg:text-8xl"
          >
            O Marketplace de quem vive o
            <br />
            OFF-ROAD!
          </h1>
          <p className="mb-7 max-w-xl text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
            Encontre produtos de lojistas parceiros e confira a compatibilidade com a sua moto antes de comprar.
          </p>
          <MotorcycleFinder fitments={fitments} primaryFitmentId={primaryFitmentId} />
        </div>
      </section>

      <TrustStrip />
      <CategoryShowcase categories={categories} />
      <FeaturedProducts products={featuredProducts} />
      <EssentialsSection categories={categories} />
      <SellerCta />
    </main>
  );
}
