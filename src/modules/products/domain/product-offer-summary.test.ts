import { describe, expect, it } from "vitest";

import { getProductOfferSummary, isVariantOnSale } from "./product-offer-summary";

const base = { promotionalPriceInCents: null, promotionStartsAt: null, promotionEndsAt: null };

describe("getProductOfferSummary", () => {
  it("returns empty summary without variants", () => {
    expect(getProductOfferSummary([])).toEqual({
      lowestPriceInCents: null,
      highestPriceInCents: null,
      hasPriceRange: false,
      hasStock: false,
      hasPromotion: false,
    });
  });

  it("computes range, stock and promotion", () => {
    const summary = getProductOfferSummary([
      { ...base, priceInCents: 10000, inventory: { availableQuantity: 0 } },
      { ...base, priceInCents: 20000, promotionalPriceInCents: 15000, inventory: { availableQuantity: 2 } },
    ]);
    expect(summary).toEqual({
      lowestPriceInCents: 10000,
      highestPriceInCents: 15000,
      hasPriceRange: true,
      hasStock: true,
      hasPromotion: true,
    });
  });

  it("ignores promotions that are not cheaper", () => {
    expect(isVariantOnSale({ ...base, priceInCents: 100, promotionalPriceInCents: 100 })).toBe(false);
  });
});
