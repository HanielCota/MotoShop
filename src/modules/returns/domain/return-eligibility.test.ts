import { describe, expect, it } from "vitest";

import { canRequestReturn, getReturnableQuantity, isSellerOrderEligibleForReturn } from "./return-eligibility";

const item = (returnItems: Array<{ quantity: number; status: string }> = []) => ({
  quantity: 2,
  returnItems: returnItems.map(({ quantity, status }) => ({ quantity, returnRequest: { status } })),
});

describe("return eligibility", () => {
  it.each(["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "CANCELLATION_REQUESTED", "CANCELLED"])(
    "blocks returns while the seller order is %s",
    (status) => {
      expect(isSellerOrderEligibleForReturn(status)).toBe(false);
      expect(canRequestReturn({ sellerOrderStatus: status, item: item() })).toBe(false);
    },
  );

  it("allows returns only after delivery", () => {
    expect(canRequestReturn({ sellerOrderStatus: "DELIVERED", item: item() })).toBe(true);
  });

  it("ignores rejected returns and discounts active ones", () => {
    expect(getReturnableQuantity(item([{ quantity: 2, status: "REJECTED" }]))).toBe(2);
    expect(getReturnableQuantity(item([{ quantity: 1, status: "REFUNDED" }]))).toBe(1);
    expect(
      canRequestReturn({ sellerOrderStatus: "DELIVERED", item: item([{ quantity: 2, status: "UNDER_REVIEW" }]) }),
    ).toBe(false);
  });
});
