import { describe, expect, it } from "vitest";

import { couponValidityLabel, findCouponValidityError, parseCouponValidityDate } from "./coupon-validity";

describe("parseCouponValidityDate (BUG-025)", () => {
  it("starts at 00:00 Brasília time, stored in UTC", () => {
    expect(parseCouponValidityDate("01/11/2026", "start")?.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("ends at 23:59:59.999 Brasília time of the chosen day", () => {
    expect(parseCouponValidityDate("30/11/2026", "end")?.toISOString()).toBe("2026-12-01T02:59:59.999Z");
  });

  it("treats a blank field as an open bound", () => {
    expect(parseCouponValidityDate("  ", "start")).toBeUndefined();
    expect(parseCouponValidityDate(null, "end")).toBeUndefined();
  });

  it("turns text that is not a real date into an invalid Date", () => {
    expect(Number.isNaN(parseCouponValidityDate("31/02/2026", "start")?.getTime())).toBe(true);
    expect(Number.isNaN(parseCouponValidityDate("amanhã", "end")?.getTime())).toBe(true);
  });
});

describe("findCouponValidityError", () => {
  const now = new Date("2026-10-16T15:00:00Z");

  it("accepts open bounds and a single-day coupon", () => {
    expect(findCouponValidityError({}, now)).toBeNull();
    const startsAt = parseCouponValidityDate("16/10/2026", "start");
    const endsAt = parseCouponValidityDate("16/10/2026", "end");
    expect(findCouponValidityError({ startsAt, endsAt }, now)).toBeNull();
  });

  it("rejects an end before the start", () => {
    const startsAt = parseCouponValidityDate("10/11/2026", "start");
    const endsAt = parseCouponValidityDate("01/11/2026", "end");
    expect(findCouponValidityError({ startsAt, endsAt }, now)).toMatch(/não pode ser antes do início/);
  });

  it("rejects an end already over", () => {
    const endsAt = parseCouponValidityDate("15/10/2026", "end");
    expect(findCouponValidityError({ endsAt }, now)).toMatch(/já passou/);
  });
});

describe("couponValidityLabel", () => {
  const now = new Date("2026-10-20T15:00:00Z");

  it("shows the start of a coupon that only begins later, so it does not look valid now", () => {
    const startsAt = parseCouponValidityDate("01/11/2026", "start");
    const endsAt = parseCouponValidityDate("30/11/2026", "end");

    expect(couponValidityLabel({ startsAt, endsAt }, now)).toBe("de 01/11/2026 até 30/11/2026");
    expect(couponValidityLabel({ startsAt, endsAt: null }, now)).toBe("a partir de 01/11/2026");
  });

  it("keeps the short label once the coupon has started", () => {
    const startsAt = parseCouponValidityDate("01/10/2026", "start");
    const endsAt = parseCouponValidityDate("30/11/2026", "end");

    expect(couponValidityLabel({ startsAt, endsAt }, now)).toBe("até 30/11/2026");
    expect(couponValidityLabel({ startsAt: null, endsAt: null }, now)).toBe("Sem prazo");
  });
});
