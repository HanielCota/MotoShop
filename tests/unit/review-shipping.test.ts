import { expect, it } from "vitest";

import {
  VISIBLE_REVIEW_SELLER_WHERE,
  coversWholeCountry,
  storesMissingNationwideShipping,
} from "../../scripts/review-shipping";

const regional = { postalCodeStart: "01000000", postalCodeEnd: "09999999", active: true };
const nationwide = { postalCodeStart: "01000000", postalCodeEnd: "99999999", active: true };

it("counts only an active method that spans every CEP as nationwide delivery", () => {
  expect(coversWholeCountry(nationwide)).toBe(true);
  expect(coversWholeCountry(regional)).toBe(false);
  expect(coversWholeCountry({ ...nationwide, active: false })).toBe(false);
  expect(coversWholeCountry({ postalCodeStart: "00000000", postalCodeEnd: "99999999", active: true })).toBe(true);
});

// Regression: CEP 78135-380 (Mato Grosso) was refused for a demo store that only delivered in São Paulo.
it("lists the demo stores that cannot deliver to every CEP and leaves the others alone", () => {
  const stores = [
    { sellerId: "garagem", storeSlug: "review-garagem-mx", methods: [regional] },
    { sellerId: "trilha", storeSlug: "review-trilha-forte", methods: [regional, nationwide] },
    { sellerId: "racing", storeSlug: "review-racing-sul", methods: [{ ...nationwide, active: false }] },
    { sellerId: "vazia", storeSlug: "review-sem-frete", methods: [] },
  ];

  expect(storesMissingNationwideShipping(stores).map((store) => store.storeSlug)).toEqual([
    "review-garagem-mx",
    "review-racing-sul",
    "review-sem-frete",
  ]);
});

// Regression: the script picked sellers by the "review-" slug alone, and sellers choose their own slug.
it("only picks visible demo stores owned by a review account", () => {
  expect(VISIBLE_REVIEW_SELLER_WHERE.store).toEqual({ slug: { startsWith: "review-" } });
  expect(VISIBLE_REVIEW_SELLER_WHERE.status).toEqual({ in: ["APPROVED", "ACTIVE"] });
  expect(VISIBLE_REVIEW_SELLER_WHERE.members.some).toEqual({
    role: "OWNER",
    user: { email: { startsWith: "review.", endsWith: "@example.test" } },
  });
});
