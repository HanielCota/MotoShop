import { createLoader, createSerializer, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const sellerProductStatusValues = ["ALL", "DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ARCHIVED"] as const;
export type SellerProductStatus = (typeof sellerProductStatusValues)[number];
export const sellerProductStockValues = ["ALL", "IN", "LOW", "OUT"] as const;
export type SellerProductStock = (typeof sellerProductStockValues)[number];
export const sellerProductPromotionValues = ["ALL", "ON_SALE"] as const;
export const sellerProductSortValues = ["updated_newest", "updated_oldest", "name_asc", "name_desc"] as const;
export type SellerProductSort = (typeof sellerProductSortValues)[number];

export const sellerProductSearchParams = {
  productQ: parseAsString,
  productCategory: parseAsString,
  productBrand: parseAsString,
  productMinPrice: parseAsInteger,
  productMaxPrice: parseAsInteger,
  productStatus: parseAsStringLiteral(sellerProductStatusValues).withDefault("ALL"),
  productStock: parseAsStringLiteral(sellerProductStockValues).withDefault("ALL"),
  productPromotion: parseAsStringLiteral(sellerProductPromotionValues).withDefault("ALL"),
  productSort: parseAsStringLiteral(sellerProductSortValues).withDefault("updated_newest"),
  productPage: parseAsInteger.withDefault(1),
};

export const loadSellerProductSearchParams = createLoader(sellerProductSearchParams);

/** Gera URLs da listagem de produtos do lojista omitindo valores padrão. */
export const serializeSellerProductSearchParams = createSerializer(sellerProductSearchParams);
