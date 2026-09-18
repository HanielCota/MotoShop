import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const favoriteAvailabilityValues = ["ALL", "IN_STOCK", "OUT_OF_STOCK"] as const;
export type FavoriteAvailability = (typeof favoriteAvailabilityValues)[number];
export const favoriteSortValues = ["newest", "oldest"] as const;
export type FavoriteSort = (typeof favoriteSortValues)[number];

export const favoriteSearchParams = {
  favoriteQ: parseAsString,
  favoriteAvailability: parseAsStringLiteral(favoriteAvailabilityValues).withDefault("ALL"),
  favoriteSort: parseAsStringLiteral(favoriteSortValues).withDefault("newest"),
  favoritePage: parseAsInteger.withDefault(1),
};

export const loadFavoriteSearchParams = createLoader(favoriteSearchParams);
