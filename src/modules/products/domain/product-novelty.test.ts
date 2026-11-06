import { describe, expect, it } from "vitest";

import { isNewProduct } from "./product-novelty";

const now = new Date("2026-10-13T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe("isNewProduct", () => {
  it("is new for 30 days after approval", () => {
    expect(isNewProduct({ reviewedAt: daysAgo(0), createdAt: daysAgo(90) }, now, 30)).toBe(true);
    expect(isNewProduct({ reviewedAt: daysAgo(29.9), createdAt: daysAgo(90) }, now, 30)).toBe(true);
    expect(isNewProduct({ reviewedAt: daysAgo(30), createdAt: daysAgo(90) }, now, 30)).toBe(false);
  });

  it("uses the approval date even when the product was created long before", () => {
    expect(isNewProduct({ reviewedAt: daysAgo(2), createdAt: daysAgo(200) }, now, 30)).toBe(true);
    expect(isNewProduct({ reviewedAt: daysAgo(45), createdAt: daysAgo(1) }, now, 30)).toBe(false);
  });

  it("falls back to the creation date without an approval date", () => {
    expect(isNewProduct({ reviewedAt: null, createdAt: daysAgo(5) }, now, 30)).toBe(true);
    expect(isNewProduct({ reviewedAt: null, createdAt: daysAgo(31) }, now, 30)).toBe(false);
  });

  it("follows the number of days configured in the Admin", () => {
    const product = { reviewedAt: daysAgo(40), createdAt: daysAgo(90) };

    expect(isNewProduct(product, now, 45)).toBe(true);
    expect(isNewProduct(product, now, 30)).toBe(false);
  });

  it("never shows the badge when the Admin sets 0 days, not even for a future date", () => {
    expect(isNewProduct({ reviewedAt: daysAgo(0), createdAt: daysAgo(0) }, now, 0)).toBe(false);
    expect(isNewProduct({ reviewedAt: daysAgo(-1), createdAt: daysAgo(0) }, now, 0)).toBe(false);
  });
});
