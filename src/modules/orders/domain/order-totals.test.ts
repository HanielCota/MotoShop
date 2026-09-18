import { describe, expect, it } from "vitest";

import { calculateOrderTotals } from "./order-totals";

describe("calculateOrderTotals", () => {
  it("combines line discounts, order discounts, and shipping", () => {
    const totals = calculateOrderTotals({
      lines: [
        { unitPriceInCents: 10_000, quantity: 2, discountAmountInCents: 1_000 },
        { unitPriceInCents: 5_000, quantity: 1 },
      ],
      orderDiscountAmountInCents: 2_000,
      shippingAmountInCents: 3_000,
      marketplaceShippingSubsidyInCents: 500,
      sellerShippingSubsidyInCents: 500,
    });

    expect(totals).toEqual({
      itemsSubtotalInCents: 25_000,
      discountAmountInCents: 3_000,
      shippingAmountInCents: 3_000,
      customerShippingAmountInCents: 2_000,
      marketplaceSubsidyInCents: 500,
      sellerSubsidyInCents: 500,
      totalAmountInCents: 24_000,
    });
  });

  it("supports fully subsidized shipping", () => {
    const totals = calculateOrderTotals({
      lines: [{ unitPriceInCents: 10_000, quantity: 1 }],
      shippingAmountInCents: 3_000,
      marketplaceShippingSubsidyInCents: 1_000,
      sellerShippingSubsidyInCents: 2_000,
    });

    expect(totals.customerShippingAmountInCents).toBe(0);
    expect(totals.totalAmountInCents).toBe(10_000);
  });

  it("rejects a discount larger than the item subtotal", () => {
    expect(() =>
      calculateOrderTotals({
        lines: [{ unitPriceInCents: 1_000, quantity: 1 }],
        orderDiscountAmountInCents: 1_001,
      }),
    ).toThrow("cannot exceed");
  });
});
