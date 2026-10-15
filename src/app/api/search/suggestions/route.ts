import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { listSearchSuggestions } from "@/modules/products/queries/search-suggestions";
import { searchSuggestionsQuerySchema } from "@/modules/products/schemas/search-suggestions";
import { consumeRateLimit } from "@/shared/rate-limit/consume-rate-limit";
import { getClientIp } from "@/shared/request/client-ip";

const LIMIT = { windowSeconds: 60, max: 60 } as const;

/** Public typeahead for the storefront searches; only approved products, at most five. */
export async function GET(request: NextRequest) {
  const parsed = searchSuggestionsQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    sellerId: request.nextUrl.searchParams.get("sellerId") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ suggestions: [] }, { status: 400 });

  try {
    // Each anonymous call runs the ranking SQL; varied queries bypass the HTTP cache (L-03).
    const limit = await consumeRateLimit({ key: `search-suggestions:ip:${getClientIp(request.headers)}`, ...LIMIT });
    if (!limit.allowed)
      return NextResponse.json(
        { suggestions: [] },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? LIMIT.windowSeconds) } },
      );

    const suggestions = await listSearchSuggestions({ query: parsed.data.q, sellerId: parsed.data.sellerId });
    return NextResponse.json(
      { suggestions },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } },
    );
  } catch (error) {
    logger.error({ event: "search.suggestions.failed", error });
    return NextResponse.json({ suggestions: [] }, { status: 500 });
  }
}
