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

  it.each([
    { percentageBps: null, fixedAmountInCents: null },
    { percentageBps: 10_001, fixedAmountInCents: null },
    { percentageBps: 1_000, fixedAmountInCents: 500 },
  ])("rejects inconsistent or out-of-range percentage configuration: %o", ({ percentageBps, fixedAmountInCents }) => {
    expect(() =>
      calculateCouponDiscount(
        { discountType: "PERCENTAGE", percentageBps, fixedAmountInCents, minimumPurchaseInCents: 0 },
        10_000,
      ),
    ).toThrow("configurado incorretamente");
  });

  it.each([
    { percentageBps: null, fixedAmountInCents: null },
    { percentageBps: 1_000, fixedAmountInCents: 500 },
    { percentageBps: null, fixedAmountInCents: 0 },
    { percentageBps: null, fixedAmountInCents: 2_147_483_648 },
  ])("rejects inconsistent fixed-amount configuration: %o", ({ percentageBps, fixedAmountInCents }) => {
    expect(() =>
      calculateCouponDiscount(
        { discountType: "FIXED_AMOUNT", percentageBps, fixedAmountInCents, minimumPurchaseInCents: 0 },
        10_000,
      ),
    ).toThrow("configurado incorretamente");
  });
});

describe("allocateDiscountAcrossSubtotals", () => {
  it("allocates the entire discount without losing remainder cents", () => {
    expect(allocateDiscountAcrossSubtotals([10_000, 5_000], 1_000)).toEqual([667, 333]);
  });
  it("never allocates more than an item subtotal, including a zero last item", () => {
    expect(allocateDiscountAcrossSubtotals([100, 100, 1], 200)).toEqual([100, 99, 1]);
    expect(allocateDiscountAcrossSubtotals([1, 1, 1, 1, 0], 3)).toEqual([1, 1, 1, 0, 0]);
  });
  it("preserves the sum and per-item limits across boundary combinations", () => {
    for (let a = 0; a <= 10; a++)
      for (let b = 0; b <= 10; b++) {
        for (let discount = 0; discount <= a + b; discount++) {
          const result = allocateDiscountAcrossSubtotals([a, b], discount);
          expect(result.reduce((sum, value) => sum + value, 0)).toBe(discount);
          expect(result[0]).toBeLessThanOrEqual(a);
          expect(result[1]).toBeLessThanOrEqual(b);
          expect(result.every((value) => Number.isSafeInteger(value) && value >= 0)).toBe(true);
        }
      }
  });
});
