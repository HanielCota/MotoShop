type ReviewableProduct = {
  category: { active: boolean };
  brand: { active: boolean };
  variants: { active: boolean; priceInCents: number }[];
};

export function getProductReviewIssues(product: ReviewableProduct): string[] {
  const issues: string[] = [];

  if (!product.category.active) issues.push("A categoria deste produto não está ativa.");
  if (!product.brand.active) issues.push("A marca deste produto não está ativa.");
  if (!product.variants.some((variant) => variant.active && variant.priceInCents > 0)) {
    issues.push("Cadastre ao menos uma variação ativa com preço válido.");
  }

  return issues;
}
