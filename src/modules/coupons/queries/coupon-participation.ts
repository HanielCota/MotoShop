import "server-only";

import { db } from "@/lib/database";
import { resolvePage } from "@/modules/products/domain/pagination";

/** Moto Shop campaigns: owned by the marketplace and paid for by each seller that joins. */
const campaignWhere = { ownerType: "MARKETPLACE", fundedBy: "SELLER" } as const;

const pageSize = 20;

/**
 * Campaigns a seller can join or leave in the Central do Lojista: active and not expired,
 * with the seller's own participation status. Never exposes other sellers' participation.
 */
export async function listMarketplaceCouponsForSeller(sellerId: string, input: { page?: number } = {}) {
  const now = new Date();
  const where = {
    ...campaignWhere,
    active: true,
    OR: [{ endsAt: null }, { endsAt: { gte: now } }],
  };
  const total = await db.coupon.count({ where });
  const { page, pageCount, skip } = resolvePage(input.page, total, pageSize);
  const coupons = await db.coupon.findMany({
    where,
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    skip,
    take: pageSize,
    select: {
      id: true,
      code: true,
      discountType: true,
      percentageBps: true,
      fixedAmountInCents: true,
      minimumPurchaseInCents: true,
      startsAt: true,
      endsAt: true,
      sellerParticipations: { where: { sellerId }, select: { joinedAt: true, leftAt: true } },
    },
  });

  return {
    coupons: coupons.map(({ sellerParticipations, ...coupon }) => {
      const participation = sellerParticipations[0];
      return {
        ...coupon,
        joined: participation ? participation.leftAt === null : false,
        joinedAt: participation?.leftAt === null ? participation.joinedAt : null,
      };
    }),
    total,
    page,
    pageCount,
  };
}

/** Admin view of who joined a campaign (current and past participants). */
export async function listCouponParticipants(couponId: string) {
  return db.couponSellerParticipation.findMany({
    where: { couponId, coupon: campaignWhere },
    orderBy: [{ leftAt: { sort: "asc", nulls: "first" } }, { joinedAt: "asc" }],
    select: {
      sellerId: true,
      joinedAt: true,
      leftAt: true,
      seller: { select: { store: { select: { name: true, slug: true } } } },
    },
  });
}

/** Sellers whose items a campaign discounts right now (used by the checkout). */
export async function listActiveCouponParticipantSellerIds(couponId: string): Promise<string[]> {
  const participations = await db.couponSellerParticipation.findMany({
    where: { couponId, leftAt: null },
    select: { sellerId: true },
  });
  return participations.map((participation) => participation.sellerId);
}
