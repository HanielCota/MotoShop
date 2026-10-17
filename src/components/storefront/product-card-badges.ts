export type ProductCardBadge = "SPONSORED" | "SALE" | "NEW";

/** At most two badges on the card image, so the photo stays visible on phones. */
export const MAX_PRODUCT_CARD_BADGES = 2;

/**
 * Badges in priority order: "Patrocinado" identifies the content and must win (AGENTS.md §16);
 * then "Oferta", then "Novidade". Test products get no badge of their own: the storefront behaves
 * like production.
 */
export function getProductCardBadges(input: {
  sponsored: boolean;
  onSale: boolean;
  isNew: boolean;
}): ProductCardBadge[] {
  const candidates: Array<[ProductCardBadge, boolean]> = [
    ["SPONSORED", input.sponsored],
    ["SALE", input.onSale],
    ["NEW", input.isNew],
  ];
  return candidates
    .filter(([, visible]) => visible)
    .map(([badge]) => badge)
    .slice(0, MAX_PRODUCT_CARD_BADGES);
}
