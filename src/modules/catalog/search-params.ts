import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const publicStoreProductSortValues = [
  "relevance",
  "newest",
  "recent_offers",
  "price_asc",
  "price_desc",
] as const;
export const publicStoreReviewSortValues = ["newest", "oldest"] as const;
export const publicCatalogSortValues = publicStoreProductSortValues;
export const publicCatalogAvailabilityValues = ["ALL", "IN_STOCK", "OUT_OF_STOCK"] as const;
export const publicCatalogPromotionValues = ["ALL", "ON_SALE"] as const;

export const publicStoreSearchParams = {
  storeReviewPage: parseAsInteger.withDefault(1),
  storeProductPage: parseAsInteger.withDefault(1),
  storeProductQ: parseAsString,
  storeProductAvailability: parseAsStringLiteral(publicCatalogAvailabilityValues).withDefault("ALL"),
  storeProductPromotion: parseAsStringLiteral(publicCatalogPromotionValues).withDefault("ALL"),
  storeProductSort: parseAsStringLiteral(publicStoreProductSortValues).withDefault("relevance"),
  storeReviewSort: parseAsStringLiteral(publicStoreReviewSortValues).withDefault("newest"),
};

export const publicCatalogSearchParams = {
  page: parseAsInteger.withDefault(1),
  sort: parseAsStringLiteral(publicCatalogSortValues).withDefault("relevance"),
  availability: parseAsStringLiteral(publicCatalogAvailabilityValues).withDefault("ALL"),
  promotion: parseAsStringLiteral(publicCatalogPromotionValues).withDefault("ALL"),
};

export const loadPublicStoreSearchParams = createLoader(publicStoreSearchParams);
export const loadPublicCatalogSearchParams = createLoader(publicCatalogSearchParams);
