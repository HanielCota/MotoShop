import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

import {
  SEARCH_SUGGESTION_MIN_LENGTH,
  searchSuggestionsResponseSchema,
  type SearchSuggestion,
} from "../../schemas/search-suggestions";

const DEBOUNCE_MS = 250;

/** Debounced suggestions for the typed text; empty below the minimum length. */
export function useSearchSuggestions(query: string, sellerId?: string): SearchSuggestion[] {
  // Keeps the last results while a new request is pending, so the list does not flicker while typing.
  const [loaded, setLoaded] = useState<SearchSuggestion[]>([]);
  const trimmed = query.trim();
  const searchable = trimmed.length >= SEARCH_SUGGESTION_MIN_LENGTH;

  useEffect(() => {
    if (!searchable) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const suggestions = await fetchSuggestions(trimmed, sellerId, controller.signal);
      if (suggestions) setLoaded(suggestions);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, sellerId, searchable]);

  return searchable ? loaded : [];
}

async function fetchSuggestions(query: string, sellerId: string | undefined, signal: AbortSignal) {
  const params = new URLSearchParams({ q: query });
  if (sellerId) params.set("sellerId", sellerId);

  try {
    const response = await fetch(`/api/search/suggestions?${params.toString()}`, { signal });
    if (!response.ok) return null;

    const parsed = searchSuggestionsResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.suggestions : null;
  } catch (error) {
    if (signal.aborted) return null;

    // Suggestions are optional: the plain search keeps working, so report and show nothing.
    Sentry.captureException(error);
    return null;
  }
}
