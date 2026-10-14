import { describe, expect, it } from "vitest";

import { canonicalCouponCustomerEmail } from "./coupon-customer-key";

describe("canonicalCouponCustomerEmail (M-07)", () => {
  it.each([
    ["Rider@Example.com", "rider@example.com"],
    [" rider+promo@example.com ", "rider@example.com"],
    ["ri.der+1@gmail.com", "rider@gmail.com"],
    ["R.i.D.e.R@GoogleMail.com", "rider@gmail.com"],
    ["ri.der@outlook.com", "ri.der@outlook.com"],
    ["not-an-email", "not-an-email"],
  ])("%s → %s", (email, canonical) => {
    expect(canonicalCouponCustomerEmail(email)).toBe(canonical);
  });
});
