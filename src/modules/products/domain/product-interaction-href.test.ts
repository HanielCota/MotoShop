import { describe, expect, it } from "vitest";

import { buildProductInteractionHref } from "./product-interaction-href";

const defaults = {
  reviewRating: null,
  reviewSort: "newest" as const,
  reviewPage: 1,
  questionPage: 1,
  questionSort: "newest" as const,
};

describe("buildProductInteractionHref", () => {
  it("omits defaults", () => expect(buildProductInteractionHref("x", defaults)).toBe("/products/x"));
  it("preserves other section state", () => {
    expect(
      buildProductInteractionHref(
        "x",
        { ...defaults, reviewRating: 4, questionPage: 2 },
        { reviewPage: 3 },
        "avaliacoes",
      ),
    ).toBe("/products/x?reviewRating=4&reviewPage=3&questionPage=2#avaliacoes");
  });
});
