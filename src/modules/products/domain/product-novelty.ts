const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Whether an approved product shows the "Novidade" badge.
 *
 * @remarks A product is new for `newProductDays` after its approval (`reviewedAt`); products without
 * an approval date fall back to when they were created. Future dates (clock skew) also count as new.
 * @param newProductDays - Days the badge lasts, from Admin › Configurações › Limites; 0 turns it off.
 */
export function isNewProduct(
  product: { reviewedAt: Date | null; createdAt: Date },
  now: Date,
  newProductDays: number,
): boolean {
  if (newProductDays <= 0) return false;

  const publishedAt = product.reviewedAt ?? product.createdAt;
  return now.getTime() - publishedAt.getTime() < newProductDays * DAY_IN_MS;
}
