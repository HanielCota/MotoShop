import { describe, expect, it } from "vitest";

import { canRequestCancellation } from "./cancellation-eligibility";

const base = { sellerOrderStatus: "PAID", shipmentStatus: null, cancellationStatuses: [], returnStatuses: [] };

describe("cancellation eligibility", () => {
  it("allows cancellation of paid orders that were not posted", () => {
    expect(canRequestCancellation(base)).toBe(true);
    expect(canRequestCancellation({ ...base, sellerOrderStatus: "PROCESSING", shipmentStatus: "READY_TO_SHIP" })).toBe(
      true,
    );
  });

  it("blocks posted, already requested or returned orders", () => {
    expect(canRequestCancellation({ ...base, shipmentStatus: "IN_TRANSIT" })).toBe(false);
    expect(canRequestCancellation({ ...base, sellerOrderStatus: "SHIPPED" })).toBe(false);
    expect(canRequestCancellation({ ...base, cancellationStatuses: ["REQUESTED"] })).toBe(false);
    expect(canRequestCancellation({ ...base, cancellationStatuses: ["REJECTED"] })).toBe(true);
    expect(canRequestCancellation({ ...base, returnStatuses: ["UNDER_REVIEW"] })).toBe(false);
  });
});
