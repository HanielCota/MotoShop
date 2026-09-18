import { ApplicationError } from "@/shared/errors/application-error";

export function hasActivePromotion(
  variant: {
    promotionalPriceInCents: number | null;
    promotionStartsAt: Date | null;
    promotionEndsAt: Date | null;
  },
  now = new Date(),
): boolean {
  return (
    variant.promotionalPriceInCents !== null &&
    (!variant.promotionStartsAt || variant.promotionStartsAt <= now) &&
    (!variant.promotionEndsAt || variant.promotionEndsAt >= now)
  );
}

export function getCurrentPriceInCents(
  variant: {
    priceInCents: number;
    promotionalPriceInCents: number | null;
    promotionStartsAt: Date | null;
    promotionEndsAt: Date | null;
  },
  now = new Date(),
): number {
  const promotionActive = hasActivePromotion(variant, now);
  const price = promotionActive ? (variant.promotionalPriceInCents ?? variant.priceInCents) : variant.priceInCents;
  if (!Number.isSafeInteger(price) || price < 0)
    throw new ApplicationError({ code: "INVALID_MONEY", message: "Preço inválido." });
  return price;
}
