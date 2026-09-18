import { describe, expect, it } from "vitest";

import { calculateCommissionInCents, multiplyMoneyInCents } from "./money";

describe("calculateCommissionInCents", () => {
  it("calculates basis points using integer cents", () => {
    expect(calculateCommissionInCents(149_990, 1_200)).toBe(17_999);
  });

  it("rounds half cents away from zero", () => {
    expect(calculateCommissionInCents(105, 1_200)).toBe(13);
  });

  it("rejects percentages outside the basis point range", () => {
    expect(() => calculateCommissionInCents(10_000, 10_001)).toThrow("commissionBps");
  });
});

describe("multiplyMoneyInCents", () => {
  it("keeps multiplication in integer cents", () => {
    expect(multiplyMoneyInCents(129_990, 2)).toBe(259_980);
  });
});
