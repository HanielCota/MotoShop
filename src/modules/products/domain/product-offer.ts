import { getCurrentPriceInCents } from "./pricing";
type Variant = Parameters<typeof getCurrentPriceInCents>[0] & {
  active?: boolean;
  inventory?: { availableQuantity: number } | null;
};
export function getProductOffer(variants: Variant[], now = new Date()) {
  const active = variants.filter((variant) => variant.active !== false);
  const prices = active.map((variant) => getCurrentPriceInCents(variant, now));
  return {
    priceInCents: prices.length ? Math.min(...prices) : null,
    hasPriceRange: new Set(prices).size > 1,
    availableQuantity: active.reduce((sum, variant) => sum + (variant.inventory?.availableQuantity ?? 0), 0),
  };
}
