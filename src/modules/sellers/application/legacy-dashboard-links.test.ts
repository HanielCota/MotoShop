import { describe, expect, it } from "vitest";

import { getLegacySellerDashboardRedirect } from "./legacy-dashboard-links";

describe("getLegacySellerDashboardRedirect", () => {
  it("sends legacy inventory history filters to the history page (UX-09)", () => {
    expect(getLegacySellerDashboardRedirect({ q: "capacete", movementType: "SALE" })).toBe(
      "/seller/products/inventory-history?q=capacete&movementType=SALE",
    );
  });

  it("keeps the overview for the permission notice", () => {
    expect(getLegacySellerDashboardRedirect({ error: "permission" })).toBeNull();
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
