const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** How long an approved product shows the "Novidade" badge (decision of 13/10/2026). */
export const NEW_PRODUCT_DAYS = 30;

/**
 * A product is new for `NEW_PRODUCT_DAYS` after its approval (`reviewedAt`); products without an
 * approval date fall back to when they were created. Future dates (clock skew) also count as new.
 */
export function isNewProduct(product: { reviewedAt: Date | null; createdAt: Date }, now: Date): boolean {
  const publishedAt = product.reviewedAt ?? product.createdAt;
  return now.getTime() - publishedAt.getTime() < NEW_PRODUCT_DAYS * DAY_IN_MS;
}
