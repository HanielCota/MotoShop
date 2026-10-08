import { describe, expect, it } from "vitest";

import { getLegacySellerDashboardRedirect } from "./legacy-dashboard-links";

describe("getLegacySellerDashboardRedirect", () => {
  it("keeps the overview when only inventory filters are present", () => {
    expect(getLegacySellerDashboardRedirect({ q: "capacete", movementType: "SALE" })).toBeNull();
  });

  it("sends legacy product filters to the products page", () => {
    expect(getLegacySellerDashboardRedirect({ productQ: "bota", productPage: "2", q: "x" })).toBe(
      "/seller/products?productQ=bota&productPage=2",
    );
  });

  it("sends legacy coupon filters to the coupons page", () => {
    expect(getLegacySellerDashboardRedirect({ couponQ: "TRILHA10" })).toBe("/seller/coupons?couponQ=TRILHA10");
  });
});
