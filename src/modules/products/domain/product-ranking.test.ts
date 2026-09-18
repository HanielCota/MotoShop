import { describe, expect, it } from "vitest";

import { productRankingScore, rankProducts } from "./product-ranking";

const baseProduct = {
  createdAt: new Date("2026-01-01T00:00:00Z"),
  isInStock: true,
  reviewCount: 0,
  isVip: false,
};

describe("product ranking", () => {
  it("prioritizes relevance over the VIP boost", () => {
    const relevant = { ...baseProduct, name: "Capacete Fox", isVip: false };
    const sponsoredButUnrelated = { ...baseProduct, name: "Pneu traseiro", isVip: true };

    expect(rankProducts([sponsoredButUnrelated, relevant], "capacete")).toEqual([relevant, sponsoredButUnrelated]);
  });

  it("uses stock, reputation and VIP as small ranking signals", () => {
    const product = { ...baseProduct, name: "Produto" };
    expect(productRankingScore({ ...product, isInStock: true, reviewCount: 5, isVip: true })).toBe(20);
    expect(productRankingScore({ ...product, isInStock: false, reviewCount: 0, isVip: false })).toBe(0);
  });
});
