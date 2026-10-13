/**
 * The three coupon kinds of the marketplace:
 * - "Cupom Moto Shop": owned and paid for by the marketplace, valid in every store;
 * - "Campanha com adesão": owned by the marketplace, paid for by each seller that joined it,
 *   valid only on the items of those sellers;
 * - "Cupom da loja": owned and paid for by one seller, valid only on that seller's items.
 */
export type CouponKind = "MARKETPLACE" | "SELLER_FUNDED_CAMPAIGN" | "SELLER";

export type CouponOwnership = {
  ownerType: "MARKETPLACE" | "SELLER";
  fundedBy: "MARKETPLACE" | "SELLER";
};

export function getCouponKind(coupon: CouponOwnership): CouponKind {
  if (coupon.ownerType === "SELLER") return "SELLER";
  return coupon.fundedBy === "SELLER" ? "SELLER_FUNDED_CAMPAIGN" : "MARKETPLACE";
}

export function isSellerFundedCampaign(coupon: CouponOwnership): boolean {
  return getCouponKind(coupon) === "SELLER_FUNDED_CAMPAIGN";
}
