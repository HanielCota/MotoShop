import { getCurrentPriceInCents, hasActivePromotion } from "./pricing";

type OfferVariant = Parameters<typeof getCurrentPriceInCents>[0] & {
  inventory?: { availableQuantity: number } | null;
};

export type ProductOfferSummary = {
  lowestPriceInCents: number | null;
  highestPriceInCents: number | null;
  hasPriceRange: boolean;
  hasStock: boolean;
  hasPromotion: boolean;
};

/** Resumo comercial público de um produto a partir das variantes ativas já carregadas. */
export function getProductOfferSummary(variants: OfferVariant[], now = new Date()): ProductOfferSummary {
  const prices = variants.map((variant) => getCurrentPriceInCents(variant, now));
  return {
    lowestPriceInCents: prices.length > 0 ? Math.min(...prices) : null,
    highestPriceInCents: prices.length > 0 ? Math.max(...prices) : null,
    hasPriceRange: new Set(prices).size > 1,
    hasStock: variants.some((variant) => getVariantStock(variant) > 0),
    hasPromotion: variants.some((variant) => isVariantOnSale(variant, now)),
  };
}

export function getVariantStock(variant: { inventory?: { availableQuantity: number } | null }): number {
  return variant.inventory?.availableQuantity ?? 0;
}

/** Promoção ativa e efetivamente menor que o preço cheio. */
export function isVariantOnSale(variant: Parameters<typeof hasActivePromotion>[0] & { priceInCents: number }, now = new Date()) {
  return (
    hasActivePromotion(variant, now) &&
    variant.promotionalPriceInCents !== null &&
    variant.promotionalPriceInCents < variant.priceInCents
  );
}
