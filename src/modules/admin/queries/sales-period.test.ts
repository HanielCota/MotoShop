import { describe, expect, it } from "vitest";

import { lastDayOf, resolveSalesDateRange } from "./sales-period";

// 26/10/2026 at 22:30 in São Paulo is already 27/10 in UTC.
const lateEveningInSaoPaulo = new Date("2026-10-27T01:30:00Z");

function resolve(period: Parameters<typeof resolveSalesDateRange>[0]["period"], from = "", to = "") {
  return resolveSalesDateRange({ period, from, to, now: lateEveningInSaoPaulo });
}

describe("resolveSalesDateRange", () => {
  it.each([
    ["today", "2026-10-26T03:00:00.000Z"],
    ["7d", "2026-10-20T03:00:00.000Z"],
    ["30d", "2026-09-27T03:00:00.000Z"],
    ["month", "2026-10-01T03:00:00.000Z"],
  ] as const)("starts %s at São Paulo midnight and ends after today in São Paulo", (period, start) => {
    const range = resolve(period);

    expect(range?.start.toISOString()).toBe(start);
    expect(range?.end.toISOString()).toBe("2026-10-27T03:00:00.000Z");
  });

  it("covers the whole typed days, both included, in São Paulo time", () => {
    const range = resolve("custom", "01/10/2026", "15/10/2026");

    expect(range?.start.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(range?.end.toISOString()).toBe("2026-10-16T03:00:00.000Z");
  });

  it.each([
    ["missing dates", "", ""],
    ["a missing end", "01/10/2026", ""],
    ["an invalid date", "31/02/2026", "15/10/2026"],
    ["a start after the end", "15/10/2026", "01/10/2026"],
  ])("returns no range for a custom period with %s", (_case, from, to) => {
    expect(resolve("custom", from, to)).toBeNull();
  });

  it("labels the last day inside the range, not the next midnight", () => {
    const range = resolve("today");
    if (range == null) throw new Error("expected a range for today");

    expect(lastDayOf(range).toISOString()).toBe("2026-10-27T02:59:59.999Z");
  });
});
