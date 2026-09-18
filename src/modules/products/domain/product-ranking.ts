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

export function productRankingScore(product: RankableProduct, query?: string) {
  const normalizedQuery = query ? normalize(query) : "";
  const normalizedName = normalize(product.name);
  let score = 0;

  if (normalizedQuery) {
    if (normalizedName === normalizedQuery) score += 100;
    else if (normalizedName.startsWith(normalizedQuery)) score += 50;
    else if (normalizedName.includes(normalizedQuery)) score += 20;
  }

  score += product.isInStock ? 10 : 0;
  score += Math.min(product.reviewCount, 5);
  score += product.isVip ? 5 : 0;
  return score;
}

export function rankProducts<T extends RankableProduct>(products: T[], query?: string) {
  return [...products].sort((a, b) => {
    const scoreDifference = productRankingScore(b, query) - productRankingScore(a, query);
    if (scoreDifference !== 0) return scoreDifference;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
