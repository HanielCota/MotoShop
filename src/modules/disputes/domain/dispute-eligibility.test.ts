import { describe, expect, it } from "vitest";

import { canOpenDispute } from "./dispute-eligibility";

describe("dispute eligibility", () => {
  it("allows a dispute on paid orders without an active dispute", () => {
    expect(canOpenDispute({ sellerOrderStatus: "SHIPPED", disputeStatuses: ["RESOLVED"] })).toBe(true);
  });

  it("blocks unpaid, cancelled and already disputed orders", () => {
    expect(canOpenDispute({ sellerOrderStatus: "PENDING_PAYMENT", disputeStatuses: [] })).toBe(false);
    expect(canOpenDispute({ sellerOrderStatus: "CANCELLED", disputeStatuses: [] })).toBe(false);
    expect(canOpenDispute({ sellerOrderStatus: "DELIVERED", disputeStatuses: ["UNDER_REVIEW"] })).toBe(false);
  });
});
