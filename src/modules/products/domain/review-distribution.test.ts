import { describe, expect, it } from "vitest";

import { buildRatingDistribution, toStarRating } from "./review-distribution";

describe("toStarRating", () => {
  it("rounds tenths to whole stars between 1 and 5", () => {
    expect(toStarRating(50)).toBe(5);
    expect(toStarRating(44)).toBe(4);
    expect(toStarRating(45)).toBe(5);
    expect(toStarRating(0)).toBe(1);
    expect(toStarRating(70)).toBe(5);
  });
});

describe("buildRatingDistribution", () => {
  it("returns five buckets from 5 to 1 with zero counts when empty", () => {
    expect(buildRatingDistribution([])).toEqual([
      { stars: 5, count: 0, percentage: 0 },
      { stars: 4, count: 0, percentage: 0 },
      { stars: 3, count: 0, percentage: 0 },
      { stars: 2, count: 0, percentage: 0 },
      { stars: 1, count: 0, percentage: 0 },
    ]);
  });

  it("merges grouped tenths into star buckets", () => {
    const distribution = buildRatingDistribution([
      { ratingTenths: 50, count: 3 },
      { ratingTenths: 48, count: 1 },
      { ratingTenths: 40, count: 2 },
      { ratingTenths: 10, count: 2 },
    ]);
    expect(distribution.map(({ stars, count }) => [stars, count])).toEqual([
      [5, 4],
      [4, 2],
      [3, 0],
      [2, 0],
      [1, 2],
    ]);
    expect(distribution[0]!.percentage).toBe(50);
  });
});
