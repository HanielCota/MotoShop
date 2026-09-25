import { describe, expect, it } from "vitest";
import { getCurrentPriceInCents, hasActivePromotion } from "./pricing";

describe("scheduled promotion pricing", () => {
  const variant = {
    priceInCents: 10000,
    promotionalPriceInCents: 8000,
    promotionStartsAt: new Date("2026-09-24T12:00:00Z"),
    promotionEndsAt: new Date("2026-09-25T12:00:00Z"),
  };
  it.each([
    ["2026-09-24T11:59:59Z", 10000],
    ["2026-09-24T12:00:00Z", 8000],
    ["2026-09-25T12:00:00Z", 8000],
    ["2026-09-25T12:00:01Z", 10000],
  ])("uses server time %s to choose %s cents", (now, expected) => {
    expect(getCurrentPriceInCents(variant, new Date(now))).toBe(expected);
  });
  it("handles open boundaries and removed promotions", () => {
    expect(hasActivePromotion({ ...variant, promotionStartsAt: null, promotionEndsAt: null })).toBe(true);
    expect(getCurrentPriceInCents({ ...variant, promotionalPriceInCents: null })).toBe(10000);
  });
});
