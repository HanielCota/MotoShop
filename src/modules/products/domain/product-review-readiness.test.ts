import { describe, expect, it } from "vitest";

import { getProductReviewIssues } from "./product-review-readiness";

describe("getProductReviewIssues", () => {
  it("accepts an active catalog entry with a priced variant", () => {
    expect(
      getProductReviewIssues({
        category: { active: true },
        brand: { active: true },
        variants: [{ active: true, priceInCents: 10000 }],
      }),
    ).toEqual([]);
  });

  it("rejects inactive references and unusable variants", () => {
    expect(
      getProductReviewIssues({
        category: { active: false },
        brand: { active: false },
        variants: [
          { active: false, priceInCents: 10000 },
          { active: true, priceInCents: 0 },
        ],
      }),
    ).toEqual([
      "A categoria deste produto não está ativa.",
      "A marca deste produto não está ativa.",
      "Cadastre ao menos uma variação ativa com preço válido.",
    ]);
  });
});
