import { z } from "zod";

export const SEARCH_SUGGESTION_LIMIT = 5;
export const SEARCH_SUGGESTION_MIN_LENGTH = 2;
export const SEARCH_SUGGESTION_MAX_LENGTH = 80;

/** Query string accepted by GET /api/search/suggestions. */
export const searchSuggestionsQuerySchema = z.object({
  q: z.string().trim().min(SEARCH_SUGGESTION_MIN_LENGTH).max(SEARCH_SUGGESTION_MAX_LENGTH),
  sellerId: z.cuid().optional(),
});

export const searchSuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  href: z.string(),
  imageUrl: z.string().nullable(),
  priceInCents: z.number().int().nullable(),
});

export const searchSuggestionsResponseSchema = z.object({ suggestions: z.array(searchSuggestionSchema) });

export type SearchSuggestion = z.infer<typeof searchSuggestionSchema>;
