import { formatDate, formatMoneyInCents, formatPercentFromBps } from "@/lib/format";

export type ProductPageCouponSource = {
  code: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  percentageBps: number | null;
  fixedAmountInCents: number | null;
  minimumPurchaseInCents: number;
  endsAt: Date | null;
};

/** Plain strings for the product page, formatted on the server (pt-BR, marketplace time zone). */
export type ProductPageCouponView = {
  code: string;
  discount: string;
  minimumPurchase: string | null;
  validity: string;
};

function discountLabel(coupon: ProductPageCouponSource): string {
  if (coupon.discountType === "PERCENTAGE") return `${formatPercentFromBps(coupon.percentageBps ?? 0)} de desconto`;

  return `${formatMoneyInCents(coupon.fixedAmountInCents ?? 0)} de desconto`;
}

export function toProductPageCouponView(coupon: ProductPageCouponSource): ProductPageCouponView {
  return {
    code: coupon.code,
    discount: discountLabel(coupon),
    minimumPurchase:
      coupon.minimumPurchaseInCents > 0
        ? `Compra mínima de ${formatMoneyInCents(coupon.minimumPurchaseInCents)}`
        : null,
    validity: coupon.endsAt ? `Válido até ${formatDate(coupon.endsAt)}` : "Sem data de término",
  };
}
