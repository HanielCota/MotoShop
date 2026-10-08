import { describe, expect, it } from "vitest";

import { readCouponFormInput } from "./coupon-form-input";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("readCouponFormInput", () => {
  it("converts percent to basis points and reais to cents", () => {
    const input = readCouponFormInput(
      form({ code: "trilha10", discountType: "PERCENTAGE", discountPercent: "10,5", minimumPurchase: "150,00" }),
    );
    expect(input).toMatchObject({ percentageBps: 1050, fixedAmountInCents: undefined, minimumPurchaseInCents: 15000 });
  });

  it("converts a fixed amount in reais to cents", () => {
    const input = readCouponFormInput(form({ discountType: "FIXED_AMOUNT", discountAmount: "25,9" }));
    expect(input).toMatchObject({ fixedAmountInCents: 2590, percentageBps: undefined, minimumPurchaseInCents: 0 });
  });

  it("treats blanks as absent and rejects malformed numbers", () => {
    const input = readCouponFormInput(form({ discountPercent: "dez", globalUsageLimit: "  ", minimumPurchase: "" }));
    expect(Number.isNaN(input.percentageBps)).toBe(true);
    expect(input.globalUsageLimit).toBeUndefined();
    expect(input.minimumPurchaseInCents).toBe(0);
  });
});
