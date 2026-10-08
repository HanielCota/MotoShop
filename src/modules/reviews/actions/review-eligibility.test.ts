import { describe, expect, it } from "vitest";

import { reviewEligibleOrderItemWhere } from "./review-eligibility";

describe("reviewEligibleOrderItemWhere", () => {
  it("requires delivery, ownership and no cancellation or refunded return", () => {
    expect(reviewEligibleOrderItemWhere("item-1", "user-1")).toEqual({
      id: "item-1",
      sellerOrder: {
        status: "DELIVERED",
        order: { userId: "user-1" },
        cancellationRequests: { none: { status: { in: ["REQUESTED", "APPROVED", "REFUNDED"] } } },
      },
      returnItems: { none: { returnRequest: { status: "REFUNDED" } } },
    });
  });
});
