export type ProductInteractionParams = {
  reviewRating: number | null;
  reviewSort: "newest" | "oldest";
  reviewPage: number;
  questionPage: number;
  questionSort: "newest" | "oldest";
};

/**
 * Monta a URL da página do produto preservando o estado das seções de avaliações
 * e perguntas. Cada seção passa apenas o que muda (ex.: `{ reviewPage: 2 }`).
 */
export function buildProductInteractionHref(
  slug: string,
  params: ProductInteractionParams,
  overrides: Partial<ProductInteractionParams> = {},
  hash?: string,
): string {
  const next = { ...params, ...overrides };
  const query = new URLSearchParams();
  if (next.reviewRating !== null && next.reviewRating !== undefined) query.set("reviewRating", String(next.reviewRating));
  if (next.reviewSort !== "newest") query.set("reviewSort", next.reviewSort);
  if (next.questionSort !== "newest") query.set("questionSort", next.questionSort);
  if (next.reviewPage > 1) query.set("reviewPage", String(next.reviewPage));
  if (next.questionPage > 1) query.set("questionPage", String(next.questionPage));
  const serialized = query.toString();
  return `/products/${slug}${serialized ? `?${serialized}` : ""}${hash ? `#${hash}` : ""}`;
}
