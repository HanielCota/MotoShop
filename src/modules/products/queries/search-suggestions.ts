import "server-only";

import { toProductCardData } from "@/modules/products/components/product-grid";

import { SEARCH_SUGGESTION_LIMIT, type SearchSuggestion } from "../schemas/search-suggestions";
import { listApprovedProducts } from "./products";

/**
 * Typeahead results: the first page of the public catalog search (same matching, ranking, approval and
 * seller rules), trimmed to what the suggestion list shows. Prices are computed on the server.
 */
export async function listSearchSuggestions(input: {
  query: string;
  sellerId?: string | undefined;
}): Promise<SearchSuggestion[]> {
  const result = await listApprovedProducts({
    query: input.query,
    sellerId: input.sellerId ?? null,
    pageSize: SEARCH_SUGGESTION_LIMIT,
  });
  const now = new Date();

  return result.products.map((product) => {
    const card = toProductCardData(product, now);
    return {
      id: card.id,
      name: card.name,
      href: card.href,
      imageUrl: card.imageUrl,
      priceInCents: card.priceInCents,
      isDemo: card.isDemo,
    };
  });
}
