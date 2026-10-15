import { describe, expect, it } from "vitest";

import { getCouponKind, isSellerFundedCampaign } from "./coupon-kind";

describe("getCouponKind", () => {
  it.each([
    [{ ownerType: "MARKETPLACE", fundedBy: "MARKETPLACE" }, "MARKETPLACE"],
    [{ ownerType: "MARKETPLACE", fundedBy: "SELLER" }, "SELLER_FUNDED_CAMPAIGN"],
    [{ ownerType: "SELLER", fundedBy: "SELLER" }, "SELLER"],
  ] as const)("classifies %o as %s", (coupon, kind) => {
    expect(getCouponKind(coupon)).toBe(kind);
    expect(isSellerFundedCampaign(coupon)).toBe(kind === "SELLER_FUNDED_CAMPAIGN");
  });
});
