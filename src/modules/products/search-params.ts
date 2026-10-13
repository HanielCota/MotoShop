import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const productSortValues = ["relevance", "newest", "recent_offers", "price_asc", "price_desc"] as const;
export type ProductSort = (typeof productSortValues)[number];
export const productAvailabilityValues = ["ALL", "IN_STOCK", "OUT_OF_STOCK"] as const;
export const productPromotionValues = ["ALL", "ON_SALE"] as const;

export const productsSearchParams = {
  q: parseAsString,
  moto: parseAsString,
  category: parseAsString,
  brand: parseAsString,
  seller: parseAsString,
  sort: parseAsStringLiteral(productSortValues).withDefault("relevance"),
  availability: parseAsStringLiteral(productAvailabilityValues).withDefault("ALL"),
  minPrice: parseAsInteger,
  maxPrice: parseAsInteger,
  promotion: parseAsStringLiteral(productPromotionValues).withDefault("ALL"),
  page: parseAsInteger.withDefault(1),
};

export const loadProductsSearchParams = createLoader(productsSearchParams);
