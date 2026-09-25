import { expect, it } from "vitest";
import { getProductOffer } from "./product-offer";
const variant = {
  priceInCents: 10000,
  promotionalPriceInCents: null,
  promotionStartsAt: null,
  promotionEndsAt: null,
  inventory: { availableQuantity: 0 },
};
it("uses all active variants for price and availability", () => {
  expect(
    getProductOffer([
      variant,
      { ...variant, priceInCents: 5000, inventory: { availableQuantity: 2 } },
      { ...variant, active: false, priceInCents: 1 },
    ]),
  ).toEqual({ priceInCents: 5000, hasPriceRange: true, availableQuantity: 2 });
});
it("respects promotion dates and empty offers", () => {
  expect(
    getProductOffer([{ ...variant, promotionalPriceInCents: 1000, promotionEndsAt: new Date(0) }]).priceInCents,
  ).toBe(10000);
  expect(getProductOffer([])).toEqual({ priceInCents: null, hasPriceRange: false, availableQuantity: 0 });
});
