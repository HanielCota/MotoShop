import "server-only";

import { db } from "@/lib/database";

export type ProductPageCoupon = {
  code: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  percentageBps: number | null;
  fixedAmountInCents: number | null;
  minimumPurchaseInCents: number;
  endsAt: Date | null;
};

const MAX_PRODUCT_PAGE_COUPONS = 5;

/**
 * Cupons que a loja do produto escolheu divulgar: ativos, dentro da validade e com uso
 * disponível. Só devolve o que o cliente precisa ver; limites internos não saem daqui.
 */
export async function listProductPageCoupons(productId: string): Promise<ProductPageCoupon[]> {
  const product = await db.product.findFirst({
    where: { id: productId, status: "APPROVED", seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
    select: { sellerId: true },
  });
  if (!product) return [];

  const now = new Date();
  const coupons = await db.coupon.findMany({
    where: {
      ownerType: "SELLER",
      sellerId: product.sellerId,
      showOnProductPage: true,
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: [{ endsAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    select: {
      code: true,
      discountType: true,
      percentageBps: true,
      fixedAmountInCents: true,
      minimumPurchaseInCents: true,
      endsAt: true,
      globalUsageLimit: true,
      _count: { select: { redemptions: true } },
    },
  });

  return coupons
    .filter((coupon) => coupon.globalUsageLimit === null || coupon._count.redemptions < coupon.globalUsageLimit)
    .slice(0, MAX_PRODUCT_PAGE_COUPONS)
    .map((coupon) => ({
      code: coupon.code,
      discountType: coupon.discountType,
      percentageBps: coupon.percentageBps,
      fixedAmountInCents: coupon.fixedAmountInCents,
      minimumPurchaseInCents: coupon.minimumPurchaseInCents,
      endsAt: coupon.endsAt,
    }));
}
