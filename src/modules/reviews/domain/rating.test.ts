import { describe, expect, it } from "vitest";

import { averageRating, formatRating } from "./rating";

describe("averageRating", () => {
  it("returns null for no reviews", () => expect(averageRating([])).toBeNull());
  it("averages ratings", () => expect(averageRating([{ rating: 4 }, { rating: 5 }])).toBe(4.5));
  it("formats in pt-BR", () => expect(formatRating(4.5)).toBe("4,5"));
});
