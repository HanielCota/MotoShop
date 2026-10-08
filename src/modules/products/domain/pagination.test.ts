import { describe, expect, it } from "vitest";

import { MAX_REQUESTED_PAGE, normalizeRequestedPage, resolvePage } from "./pagination";

describe("normalizeRequestedPage", () => {
  it("keeps valid pages and falls back to 1 for missing, negative or non-finite values", () => {
    expect(normalizeRequestedPage(3)).toBe(3);
    expect(normalizeRequestedPage(undefined)).toBe(1);
    expect(normalizeRequestedPage(null)).toBe(1);
    expect(normalizeRequestedPage(-5)).toBe(1);
    expect(normalizeRequestedPage(Number.NaN)).toBe(1);
    expect(normalizeRequestedPage(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("caps huge URL pages so the database offset cannot overflow", () => {
    // `?reviewPage=99999999999999999999` parses to 1e20 and used to crash the page.
    expect(normalizeRequestedPage(1e20)).toBe(MAX_REQUESTED_PAGE);
  });
});

describe("resolvePage", () => {
  it("clamps a page past the end to the last existing page", () => {
    expect(resolvePage(9, 7, 6)).toEqual({ page: 2, pageCount: 2, skip: 6 });
    expect(resolvePage(1e20, 7, 6)).toEqual({ page: 2, pageCount: 2, skip: 6 });
  });

  it("returns a single empty page when there are no items", () => {
    expect(resolvePage(4, 0, 6)).toEqual({ page: 1, pageCount: 1, skip: 0 });
  });
});
