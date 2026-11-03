import { expect, it } from "vitest";

import { REVIEW_STORE_WHERE, reviewBrandId, reviewBrandWhere, reviewCouponWhere } from "../../scripts/review-scope";
import { reviewId } from "../../scripts/review-seed-ids";

// Regression guard: the removal script found demo stores and brands by the " · demonstração" and
// "(demonstração)" names, so cleaning those texts would have left the demo data behind.
it("recognises demo stores and brands without reading any name", () => {
  expect(JSON.stringify(REVIEW_STORE_WHERE)).not.toContain("demonstração");
  expect(JSON.stringify(reviewBrandWhere([]))).not.toContain("demonstração");
  expect(REVIEW_STORE_WHERE).not.toHaveProperty("name");
  expect(reviewBrandWhere([])).not.toHaveProperty("name");
});

it("keeps demo stores tied to a demo owner and demo brands to the seed's fixed IDs", () => {
  expect(REVIEW_STORE_WHERE.slug).toEqual({ startsWith: "review-" });
  expect(REVIEW_STORE_WHERE.seller.members.some.user.email).toEqual({
    startsWith: "review.",
    endsWith: "@example.test",
  });
  expect(reviewBrandWhere(["product-1"])).toEqual({
    id: { in: ["Pista", "Trilha", "Areia", "Box", "Largada"].map((label) => reviewId("brand", label)) },
    slug: { startsWith: "review-marca-" },
    products: { none: { id: { notIn: ["product-1"] } } },
  });
  expect(reviewBrandId("Pista")).toBe(reviewId("brand", "Pista"));
});

// Regression: the real run aborted on coupons_sellerId_fkey, because demo stores had coupons created by
// hand during the review and only the seed's REVIEW-* codes were in scope.
it("takes every coupon of a demo store, not only the seed's REVIEW-* codes", () => {
  expect(reviewCouponWhere(["seller-1"])).toEqual({
    OR: [{ code: { startsWith: "REVIEW-" } }, { sellerId: { in: ["seller-1"] } }],
  });
});
