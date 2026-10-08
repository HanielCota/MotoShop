/** Média simples de notas (1–5). Retorna `null` quando não há avaliações. */
export function averageRating(reviews: { rating: number }[]): number | null {
  if (reviews.length === 0) return null;
  return reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
}

/** Formata uma nota em pt-BR com uma casa decimal, ex.: 4,5. */
export function formatRating(value: number): string {
  return value.toFixed(1).replace(".", ",");
}
