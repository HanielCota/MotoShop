import { describe, expect, it } from "vitest";

import { parseMoneyFilterToCents } from "./money-filter";

describe("parseMoneyFilterToCents", () => {
  it.each([
    ["50", 5_000],
    ["50,00", 5_000],
    ["50.00", 5_000],
    ["0,5", 50],
    ["0", 0],
  ])("parses %s as integer cents", (input, expected) => {
    expect(parseMoneyFilterToCents(input)).toBe(expected);
  });

  it.each(["", "-1", "1.234,56", "10,999", "abc", "1e3"])("rejects invalid currency input %s", (input) => {
    expect(parseMoneyFilterToCents(input)).toBeNull();
  });
});
