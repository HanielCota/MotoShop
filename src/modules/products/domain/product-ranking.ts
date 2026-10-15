export type RankableProduct = {
  name: string;
  createdAt: Date;
  isInStock: boolean;
  reviewCount: number;
  isVip: boolean;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function nameMatchScore(normalizedName: string, normalizedQuery: string) {
  if (!normalizedQuery) return 0;
  if (normalizedName === normalizedQuery) return 100;
  if (normalizedName.startsWith(normalizedQuery)) return 50;
  if (normalizedName.includes(normalizedQuery)) return 20;
  return 0;
}

export function productRankingScore(product: RankableProduct, query?: string) {
  const normalizedQuery = query ? normalize(query) : "";
  const normalizedName = normalize(product.name);
  const availabilityScore = product.isInStock ? 10 : 0;
  const reputationScore = Math.min(product.reviewCount, 5);
  const vipScore = product.isVip ? 5 : 0;
  return nameMatchScore(normalizedName, normalizedQuery) + availabilityScore + reputationScore + vipScore;
}

export function rankProducts<T extends RankableProduct>(products: T[], query?: string) {
  return [...products].sort((a, b) => {
    const scoreDifference = productRankingScore(b, query) - productRankingScore(a, query);
    if (scoreDifference !== 0) return scoreDifference;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
