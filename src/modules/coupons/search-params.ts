import { createLoader, createSerializer, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const couponActiveValues = ["ALL", "ACTIVE", "INACTIVE"] as const;
export type CouponActiveFilter = (typeof couponActiveValues)[number];
export const couponValidityValues = ["ALL", "CURRENT", "UPCOMING", "EXPIRED"] as const;
export type CouponValidityFilter = (typeof couponValidityValues)[number];
export const couponSortValues = ["newest", "oldest", "ends_soonest", "code_asc"] as const;
export type CouponSort = (typeof couponSortValues)[number];

export const couponSearchParams = {
  couponQ: parseAsString,
  couponActive: parseAsStringLiteral(couponActiveValues).withDefault("ALL"),
  couponValidity: parseAsStringLiteral(couponValidityValues).withDefault("ALL"),
  couponSort: parseAsStringLiteral(couponSortValues).withDefault("newest"),
  couponPage: parseAsInteger.withDefault(1),
  /** Campanha cujas lojas participantes o Admin está vendo. */
  campaignId: parseAsString,
  /** Página das campanhas do Moto Shop na Central do Lojista. */
  campaignPage: parseAsInteger.withDefault(1),
};

export const loadCouponSearchParams = createLoader(couponSearchParams);

/** Gera URLs da listagem de cupons omitindo valores padrão. */
export const serializeCouponSearchParams = createSerializer(couponSearchParams);
