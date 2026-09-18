import { describe, expect, it } from "vitest";

import { allocateDiscountAcrossSubtotals, calculateCouponDiscount } from "./coupon-discount";

describe("calculateCouponDiscount", () => {
  it("calculates percentage discounts in integer cents", () => {
    expect(
      calculateCouponDiscount(
        { discountType: "PERCENTAGE", percentageBps: 1_000, fixedAmountInCents: null, minimumPurchaseInCents: 0 },
        10_000,
      ),
    ).toBe(1_000);
  });

  it("caps fixed discounts at the eligible subtotal", () => {
    expect(
      calculateCouponDiscount(
        { discountType: "FIXED_AMOUNT", percentageBps: null, fixedAmountInCents: 20_000, minimumPurchaseInCents: 0 },
        10_000,
      ),
    ).toBe(10_000);
  });

  it("enforces the minimum purchase", () => {
    expect(() =>
      calculateCouponDiscount(
        {
          discountType: "FIXED_AMOUNT",
          percentageBps: null,
          fixedAmountInCents: 1_000,
          minimumPurchaseInCents: 10_000,
        },
        9_999,
      ),
    ).toThrow("valor mínimo");
  });
});

describe("allocateDiscountAcrossSubtotals", () => {
  it("allocates the entire discount without losing remainder cents", () => {
    expect(allocateDiscountAcrossSubtotals([10_000, 5_000], 1_000)).toEqual([666, 334]);
  });
});
