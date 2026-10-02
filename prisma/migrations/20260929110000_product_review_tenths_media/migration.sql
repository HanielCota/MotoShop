ALTER TABLE "product_reviews" DROP CONSTRAINT "product_reviews_rating_check";
ALTER TABLE "product_reviews" RENAME COLUMN "rating" TO "ratingTenths";
UPDATE "product_reviews" SET "ratingTenths" = "ratingTenths" * 10;
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_ratingTenths_check" CHECK ("ratingTenths" BETWEEN 1 AND 50);

CREATE TABLE "product_review_media" (
    "id" TEXT NOT NULL,
    "productReviewId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeInBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_review_media_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_review_media_mediaType_check" CHECK ("mediaType" IN ('image', 'video')),
    CONSTRAINT "product_review_media_sizeInBytes_check" CHECK ("sizeInBytes" > 0)
);

CREATE UNIQUE INDEX "product_review_media_storageKey_key" ON "product_review_media"("storageKey");
CREATE INDEX "product_review_media_productReviewId_sortOrder_idx" ON "product_review_media"("productReviewId", "sortOrder");
ALTER TABLE "product_review_media" ADD CONSTRAINT "product_review_media_productReviewId_fkey"
    FOREIGN KEY ("productReviewId") REFERENCES "product_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
