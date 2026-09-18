import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const sellerQuestionFilterValues = ["ALL", "UNANSWERED", "ANSWERED"] as const;
export type SellerQuestionFilter = (typeof sellerQuestionFilterValues)[number];
export const sellerQuestionSortValues = ["newest", "oldest"] as const;

export const sellerQuestionSearchParams = {
  questionFilter: parseAsStringLiteral(sellerQuestionFilterValues).withDefault("ALL"),
  questionQ: parseAsString,
  questionFrom: parseAsString,
  questionTo: parseAsString,
  questionSort: parseAsStringLiteral(sellerQuestionSortValues).withDefault("newest"),
  questionPage: parseAsInteger.withDefault(1),
};

export const loadSellerQuestionSearchParams = createLoader(sellerQuestionSearchParams);
