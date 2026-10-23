/**
 * Demo stores deliver to the whole country (decided on 23/10/2026): a demo order with a CEP outside
 * the store's own region (for example 78135-380, in Mato Grosso) must not be refused at checkout.
 * Shared by the review seed and by the script that fixes stores seeded before this rule.
 */

/** CEP range of the whole country, as own-shipping methods store it (8 digits). */
export const WHOLE_COUNTRY = { postalCodeStart: "01000000", postalCodeEnd: "99999999" } as const;

/** The own-shipping method a demo store gets when none of its methods covers the whole country. */
export const NATIONWIDE_REVIEW_METHOD = {
  name: "Entrega própria · Brasil",
  priceInCents: 3290,
  estimatedDeliveryDays: 8,
} as const;

export type ShippingRange = { postalCodeStart: string; postalCodeEnd: string; active: boolean };

export type ReviewStoreShipping = {
  sellerId: string;
  storeSlug: string;
  methods: readonly ShippingRange[];
};

/** An active method whose range starts at or before 01000000 and ends at or after 99999999. */
export function coversWholeCountry(method: ShippingRange): boolean {
  if (!method.active) return false;

  return method.postalCodeStart <= WHOLE_COUNTRY.postalCodeStart && method.postalCodeEnd >= WHOLE_COUNTRY.postalCodeEnd;
}

/** The demo stores that still need the nationwide method; the others already deliver everywhere. */
export function storesMissingNationwideShipping(stores: readonly ReviewStoreShipping[]): ReviewStoreShipping[] {
  return stores.filter((store) => !store.methods.some(coversWholeCountry));
}
