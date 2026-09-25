import { describe, expect, it } from "vitest";

import { formatPriceInputFromCents, parsePriceInputToCents } from "./price-input";

describe("product price input", () => {
  it("converts reais to integer cents without floating point math", () => {
    expect(parsePriceInputToCents("1499,90")).toBe(149990);
    expect(parsePriceInputToCents("12.5")).toBe(1250);
    expect(parsePriceInputToCents("10")).toBe(1000);
    expect(formatPriceInputFromCents(149990)).toBe("1499,90");
  });

  it("rejects ambiguous and malformed prices", () => {
    expect(Number.isNaN(parsePriceInputToCents("1.499,90"))).toBe(true);
    expect(Number.isNaN(parsePriceInputToCents("12,345"))).toBe(true);
    expect(Number.isNaN(parsePriceInputToCents("-1"))).toBe(true);
  });
});
