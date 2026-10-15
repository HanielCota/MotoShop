import { describe, expect, it } from "vitest";

import { formatDateFilter, isInvalidDateFilter, isInvertedDateRange, parseDateFilter } from "./date-filter";

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

describe("parseDateFilter", () => {
  it("accepts the common ways of typing a Brazilian date", () => {
    const expected = new Date(Date.UTC(2026, 1, 1)).toISOString();

    for (const typed of ["01/02/2026", "1/2/2026", "01-02-2026", "01.02.2026", "01022026", "2026-02-01"]) {
      expect(parseDateFilter(typed)?.toISOString()).toBe(expected);
    }
  });

  it("rejects values that are not real dates", () => {
    expect(parseDateFilter("31/02/2026")).toBeUndefined();
    expect(parseDateFilter("amanhã")).toBeUndefined();
  });
});

describe("formatDateFilter and isInvalidDateFilter", () => {
  it("normalizes a valid date and keeps an invalid one as typed", () => {
    expect(formatDateFilter("1-2-2026")).toBe("01/02/2026");
    expect(formatDateFilter("2026-02-01")).toBe("01/02/2026");
    expect(formatDateFilter("31/02/2026")).toBe("31/02/2026");
    expect(isInvalidDateFilter("31/02/2026")).toBe(true);
    expect(isInvalidDateFilter("")).toBe(false);
    expect(isInvalidDateFilter("01/02/2026")).toBe(false);
  });
});
