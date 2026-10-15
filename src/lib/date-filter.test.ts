import { describe, expect, it } from "vitest";

import { isInvertedDateRange } from "./date-filter";

describe("isInvertedDateRange", () => {
  it("flags a start date after the end date in either supported format", () => {
    expect(isInvertedDateRange("10/10/2026", "01/10/2026")).toBe(true);
    expect(isInvertedDateRange("2026-10-10", "2026-10-01")).toBe(true);
  });

  it("accepts ordered ranges, the same day and incomplete or invalid ranges", () => {
    expect(isInvertedDateRange("01/10/2026", "10/10/2026")).toBe(false);
    expect(isInvertedDateRange("10/10/2026", "10/10/2026")).toBe(false);
    expect(isInvertedDateRange("10/10/2026", null)).toBe(false);
    expect(isInvertedDateRange("31/02/2026", "01/01/2026")).toBe(false);
  });
});
