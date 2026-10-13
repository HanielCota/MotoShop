import { z } from "zod";

export const SEARCH_SUGGESTION_LIMIT = 5;
export const SEARCH_SUGGESTION_MIN_LENGTH = 2;

/** Query string accepted by GET /api/search/suggestions. */
export const searchSuggestionsQuerySchema = z.object({
  q: z.string().trim().min(SEARCH_SUGGESTION_MIN_LENGTH).max(80),
  sellerId: z.cuid().optional(),
});

export const searchSuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  href: z.string(),
  imageUrl: z.string().nullable(),
  priceInCents: z.number().int().nullable(),
  isDemo: z.boolean(),
});

export const searchSuggestionsResponseSchema = z.object({ suggestions: z.array(searchSuggestionSchema) });

export type SearchSuggestion = z.infer<typeof searchSuggestionSchema>;
