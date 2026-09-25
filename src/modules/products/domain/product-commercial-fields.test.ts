import { describe, expect, it } from "vitest";
import {
  formatPromotionDate,
  getMeasurements,
  parseOptionalInteger,
  parsePromotionDate,
} from "./product-commercial-fields";

describe("commercial form values", () => {
  it("round trips promotion dates with an explicit UTC-03 offset", () => {
    const date = parsePromotionDate("2026-09-24T10:30")!;
    expect(date.toISOString()).toBe("2026-09-24T13:30:00.000Z");
    expect(formatPromotionDate(date)).toBe("2026-09-24T10:30");
  });
  it.each(["2026-02-30T10:30", "2026-09-24T25:00", "invalid", "2026-09-24"])("rejects invalid date %s", (value) => {
    expect(Number.isNaN(parsePromotionDate(value)!.getTime())).toBe(true);
  });
  it("preserves blank measurements as inheritance, not zero", () => {
    expect(parseOptionalInteger("")).toBeNull();
    expect(parseOptionalInteger("1500")).toBe(1500);
    expect(parseOptionalInteger("1.5")).toBeNaN();
    expect(getMeasurements({})).toEqual({
      weightInGrams: null,
      heightInMillimeters: null,
      widthInMillimeters: null,
      lengthInMillimeters: null,
    });
  });
});
