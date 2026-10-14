import { describe, expect, it } from "vitest";

import { formatPriceInputFromCents, parsePriceInputToCents } from "./price-input";

describe("product price input", () => {
  it("converts reais to integer cents without floating point math", () => {
    expect(parsePriceInputToCents("1499,90")).toBe(149990);
    expect(parsePriceInputToCents("12.5")).toBe(1250);
    expect(parsePriceInputToCents("10")).toBe(1000);
    expect(formatPriceInputFromCents(149990)).toBe("1499,90");
  });

  it("accepts the Brazilian thousands separator (BUG-018)", () => {
    expect(parsePriceInputToCents("1.234,56")).toBe(123456);
    expect(parsePriceInputToCents("1.234.567,8")).toBe(123456780);
    expect(parsePriceInputToCents("1.499")).toBe(149900);
    expect(parsePriceInputToCents(" 2.000,00 ")).toBe(200000);
  });

  it("rejects ambiguous and malformed prices", () => {
    expect(Number.isNaN(parsePriceInputToCents("12,345"))).toBe(true);
    expect(Number.isNaN(parsePriceInputToCents("1,234.56"))).toBe(true);
    expect(Number.isNaN(parsePriceInputToCents("1.23.456"))).toBe(true);
    expect(Number.isNaN(parsePriceInputToCents("12.3456"))).toBe(true);
    expect(Number.isNaN(parsePriceInputToCents("-1"))).toBe(true);
    expect(Number.isNaN(parsePriceInputToCents(""))).toBe(true);
  });
});
