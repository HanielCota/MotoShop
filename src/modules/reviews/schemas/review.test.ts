import { describe, expect, it } from "vitest";

import { reviewSchema, uploadedReviewMediaSchema } from "./review";

const review = { orderItemId: "cm123456789012345678901234", media: [] };

describe("reviewSchema", () => {
  it("accepts whole stars only, stored in tenths", () => {
    expect(reviewSchema.safeParse({ ...review, productRatingTenths: 40 }).success).toBe(true);
    expect(reviewSchema.safeParse({ ...review, productRatingTenths: 43 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...review, productRatingTenths: 5 }).success).toBe(false);
  });

  it("refuses video uploads", () => {
    const media = { key: "reviews/a.mp4", fileId: "a".repeat(24) };

    expect(uploadedReviewMediaSchema.safeParse({ ...media, contentType: "video/mp4" }).success).toBe(false);
    expect(uploadedReviewMediaSchema.safeParse({ ...media, contentType: "image/webp" }).success).toBe(true);
  });
});
