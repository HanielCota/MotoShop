/** Nota inteira (1–5) exibida por avaliação; avaliações antigas em décimos são arredondadas. */
export function toStarRating(ratingTenths: number): number {
  return Math.min(Math.max(Math.round(ratingTenths / 10), 1), 5);
}

export type RatingDistribution = { stars: 1 | 2 | 3 | 4 | 5; count: number; percentage: number }[];

/** Distribuição 5★…1★ a partir de contagens agrupadas por `ratingTenths` (calculadas no banco). */
export function buildRatingDistribution(groups: { ratingTenths: number; count: number }[]): RatingDistribution {
  const counts = new Map<number, number>();
  for (const group of groups) {
    const stars = toStarRating(group.ratingTenths);
    counts.set(stars, (counts.get(stars) ?? 0) + group.count);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return ([5, 4, 3, 2, 1] as const).map((stars) => {
    const count = counts.get(stars) ?? 0;
    return { stars, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 };
  });
}
