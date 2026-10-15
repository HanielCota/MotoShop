import { describe, expect, it } from "vitest";

import { parsePromotionDate } from "./product-commercial-fields";
import { INVALID_PROMOTION_DATE, splitPromotionDateValue, toPromotionDateValue } from "./promotion-date-input";

describe("promotion date input (DN-01)", () => {
  it("combines day/month/year and a 24-hour time", () => {
    expect(toPromotionDateValue("20/11/2026", "18:30", "start")).toBe("2026-11-20T18:30");
    expect(toPromotionDateValue("20/11/2026", "7:05", "start")).toBe("2026-11-20T07:05");
  });

  it("uses the start or the end of the day when the time is empty", () => {
    expect(toPromotionDateValue("20/11/2026", "", "start")).toBe("2026-11-20T00:00");
    expect(toPromotionDateValue("30/11/2026", " ", "end")).toBe("2026-11-30T23:59");
  });

  it("keeps an empty bound open and flags anything else as invalid", () => {
    expect(toPromotionDateValue("", "", "end")).toBe("");
    expect(toPromotionDateValue("", "10:00", "end")).toBe(INVALID_PROMOTION_DATE);
    expect(toPromotionDateValue("2026-11-20", "", "start")).toBe(INVALID_PROMOTION_DATE);
    expect(toPromotionDateValue("20/11/2026", "24:00", "start")).toBe(INVALID_PROMOTION_DATE);
  });

  it("is still read by the server as Brasília time, and a non-existent day is refused", () => {
    expect(parsePromotionDate(toPromotionDateValue("20/11/2026", "00:00", "start"))?.toISOString()).toBe(
      "2026-11-20T03:00:00.000Z",
    );
    expect(Number.isNaN(parsePromotionDate(toPromotionDateValue("31/11/2026", "", "end"))?.getTime())).toBe(true);
    expect(Number.isNaN(parsePromotionDate(INVALID_PROMOTION_DATE)?.getTime())).toBe(true);
  });

  it("splits a stored value back into the two fields", () => {
    expect(splitPromotionDateValue("2026-11-20T18:30")).toEqual({ date: "20/11/2026", time: "18:30" });
    expect(splitPromotionDateValue("")).toEqual({ date: "", time: "" });
  });
});
