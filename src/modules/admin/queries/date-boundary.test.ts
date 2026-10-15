import { expect, it } from "vitest";

import { buildCreatedAtBoundaryFilter, parseDateBoundary } from "./date-boundary";

it("reads the Brazilian date typed in the Admin filters as a UTC day", () => {
  expect(parseDateBoundary("05/10/2026", false)).toEqual(new Date("2026-10-05T00:00:00.000Z"));
  expect(parseDateBoundary("05/10/2026", true)).toEqual(new Date("2026-10-06T00:00:00.000Z"));
});

it("keeps old ISO links working", () => {
  expect(parseDateBoundary("2026-10-05", false)).toEqual(new Date("2026-10-05T00:00:00.000Z"));
});

it("ignores impossible or malformed dates instead of filtering by them", () => {
  expect(parseDateBoundary("99/99/2026", false)).toBeUndefined();
  expect(parseDateBoundary("31/02/2026", false)).toBeUndefined();
  expect(parseDateBoundary("2026/05/10", false)).toBeUndefined();
  expect(parseDateBoundary("10-05-2026", false)).toBeDefined();
  expect(buildCreatedAtBoundaryFilter("99/99/2026", "")).toEqual({});
});
