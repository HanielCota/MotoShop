export type ProductCardBadge = "DEMO" | "SPONSORED" | "SALE" | "NEW";

/** At most two badges on the card image, so the photo stays visible on phones. */
export const MAX_PRODUCT_CARD_BADGES = 2;

/**
 * Badges in priority order: "Demonstração" and "Patrocinado" identify the content and must win
 * (AGENTS.md §16 and the demo rule); then "Oferta", then "Novidade". Demo products are never
 * shown as sponsored.
 */
export function getProductCardBadges(input: {
  isDemo: boolean;
  sponsored: boolean;
  onSale: boolean;
  isNew: boolean;
}): ProductCardBadge[] {
  const candidates: Array<[ProductCardBadge, boolean]> = [
    ["DEMO", input.isDemo],
    ["SPONSORED", input.sponsored && !input.isDemo],
    ["SALE", input.onSale],
    ["NEW", input.isNew],
  ];
  return candidates
    .filter(([, visible]) => visible)
    .map(([badge]) => badge)
    .slice(0, MAX_PRODUCT_CARD_BADGES);
}
