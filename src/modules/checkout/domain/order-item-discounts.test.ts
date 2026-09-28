import { expect, it } from "vitest";
import { applyOrderItemDiscounts } from "./order-item-discounts";
it("snapshots net item totals so returns cannot refund the coupon again", () => {
  const result = applyOrderItemDiscounts(
    [
      { id: "a", totalAmountInCents: 100 },
      { id: "b", totalAmountInCents: 50 },
    ],
    100,
  );
  expect(result).toEqual([
    { id: "a", totalAmountInCents: 33, discountAmountInCents: 67 },
    { id: "b", totalAmountInCents: 17, discountAmountInCents: 33 },
  ]);
  expect(result.reduce((sum, line) => sum + line.totalAmountInCents, 0)).toBe(50);
});
it("supports a fully discounted item without a negative refundable amount", () => {
  expect(applyOrderItemDiscounts([{ totalAmountInCents: 1 }], 1)[0]?.totalAmountInCents).toBe(0);
});
