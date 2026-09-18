import { createLoader, parseAsInteger, parseAsStringLiteral } from "nuqs/server";

export const productQuestionSortValues = ["newest", "oldest"] as const;
export const productReviewSortValues = ["newest", "oldest"] as const;

export const productInteractionSearchParams = {
  reviewRating: parseAsInteger,
  reviewSort: parseAsStringLiteral(productReviewSortValues).withDefault("newest"),
  reviewPage: parseAsInteger.withDefault(1),
  questionPage: parseAsInteger.withDefault(1),
  questionSort: parseAsStringLiteral(productQuestionSortValues).withDefault("newest"),
};

export const loadProductInteractionSearchParams = createLoader(productInteractionSearchParams);
