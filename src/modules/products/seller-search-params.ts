import {
  createLoader,
  createParser,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { formatPriceInputFromCents, parsePriceInputToCents } from "./domain/price-input";

export const sellerProductStatusValues = ["ALL", "DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ARCHIVED"] as const;
export type SellerProductStatus = (typeof sellerProductStatusValues)[number];
export const sellerProductStockValues = ["ALL", "IN", "LOW", "OUT"] as const;
export type SellerProductStock = (typeof sellerProductStockValues)[number];
export const sellerProductPromotionValues = ["ALL", "ON_SALE"] as const;
export const sellerProductSortValues = ["updated_newest", "updated_oldest", "name_asc", "name_desc"] as const;
export type SellerProductSort = (typeof sellerProductSortValues)[number];

/** Preço em reais na URL e no campo ("50,00"); a consulta recebe centavos. */
const parseAsPriceInReais = createParser({
  parse: (value) => {
    const cents = parsePriceInputToCents(value);
    return Number.isNaN(cents) ? null : cents;
  },
  serialize: (cents: number) => formatPriceInputFromCents(cents),
});

export const sellerProductSearchParams = {
  productQ: parseAsString,
  productCategory: parseAsString,
  productBrand: parseAsString,
  productMinPrice: parseAsPriceInReais,
  productMaxPrice: parseAsPriceInReais,
  productStatus: parseAsStringLiteral(sellerProductStatusValues).withDefault("ALL"),
  productStock: parseAsStringLiteral(sellerProductStockValues).withDefault("ALL"),
  productPromotion: parseAsStringLiteral(sellerProductPromotionValues).withDefault("ALL"),
  productSort: parseAsStringLiteral(sellerProductSortValues).withDefault("updated_newest"),
  productPage: parseAsInteger.withDefault(1),
};

export const loadSellerProductSearchParams = createLoader(sellerProductSearchParams);

/** Gera URLs da listagem de produtos do lojista omitindo valores padrão. */
export const serializeSellerProductSearchParams = createSerializer(sellerProductSearchParams);
