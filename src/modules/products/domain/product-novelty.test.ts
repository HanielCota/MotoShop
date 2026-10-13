import { describe, expect, it } from "vitest";

import { isNewProduct } from "./product-novelty";

const now = new Date("2026-10-13T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe("isNewProduct", () => {
  it("is new for 30 days after approval", () => {
    expect(isNewProduct({ reviewedAt: daysAgo(0), createdAt: daysAgo(90) }, now)).toBe(true);
    expect(isNewProduct({ reviewedAt: daysAgo(29.9), createdAt: daysAgo(90) }, now)).toBe(true);
    expect(isNewProduct({ reviewedAt: daysAgo(30), createdAt: daysAgo(90) }, now)).toBe(false);
  });

  it("uses the approval date even when the product was created long before", () => {
    expect(isNewProduct({ reviewedAt: daysAgo(2), createdAt: daysAgo(200) }, now)).toBe(true);
    expect(isNewProduct({ reviewedAt: daysAgo(45), createdAt: daysAgo(1) }, now)).toBe(false);
  });

  it("falls back to the creation date without an approval date", () => {
    expect(isNewProduct({ reviewedAt: null, createdAt: daysAgo(5) }, now)).toBe(true);
    expect(isNewProduct({ reviewedAt: null, createdAt: daysAgo(31) }, now)).toBe(false);
  });
});
