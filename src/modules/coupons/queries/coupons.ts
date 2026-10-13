import "server-only";

import { db } from "@/lib/database";
import type { CouponSort } from "../search-params";
import { resolvePage } from "@/modules/products/domain/pagination";

type CouponListInput = {
  query?: string | null;
  active?: "ALL" | "ACTIVE" | "INACTIVE";
  validity?: "ALL" | "CURRENT" | "UPCOMING" | "EXPIRED";
  sort?: CouponSort;
  page?: number;
};

function getCouponListWhere(input: CouponListInput, owner: { ownerType: "MARKETPLACE" } | { sellerId: string }) {
  const query = input.query?.trim();
  const now = new Date();
  return {
    ...owner,
    ...(input.active === "ACTIVE" ? { active: true } : {}),
    ...(input.active === "INACTIVE" ? { active: false } : {}),
    ...(input.validity === "CURRENT"
      ? {
          active: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        }
      : input.validity === "UPCOMING"
        ? { startsAt: { gt: now } }
        : input.validity === "EXPIRED"
          ? { endsAt: { lt: now } }
          : {}),
    ...(query ? { code: { contains: query, mode: "insensitive" as const } } : {}),
  };
}

export async function listMarketplaceCoupons(input: CouponListInput = {}) {
  return listCoupons(getCouponListWhere(input, { ownerType: "MARKETPLACE" }), input.page, input.sort);
}

export async function listSellerCoupons(sellerId: string, input: CouponListInput = {}) {
  return listCoupons(getCouponListWhere(input, { sellerId }), input.page, input.sort);
}

async function listCoupons(
  where: ReturnType<typeof getCouponListWhere>,
  requestedPage = 1,
  sort: CouponSort = "newest",
) {
  const pageSize = 20;
  // Count first so a huge or past-the-end ?couponPage= is clamped before it becomes an offset.
  const total = await db.coupon.count({ where });
  const { page, pageCount, skip } = resolvePage(requestedPage, total, pageSize);
  const [coupons] = await Promise.all([
    db.coupon.findMany({
      where,
      orderBy:
        sort === "oldest"
          ? [{ createdAt: "asc" }, { code: "asc" }]
          : sort === "ends_soonest"
            ? [{ endsAt: "asc" }, { createdAt: "desc" }]
            : sort === "code_asc"
              ? [{ code: "asc" }, { createdAt: "desc" }]
              : [{ createdAt: "desc" }, { code: "asc" }],
      skip,
      take: pageSize,
      include: {
        _count: { select: { redemptions: true, sellerParticipations: { where: { leftAt: null } } } },
      },
    }),
  ]);
  return { coupons, total, page, pageCount };
}

/** Um cupom do marketplace pelo id, para telas do Admin. */
export async function getMarketplaceCoupon(couponId: string) {
  return db.coupon.findFirst({
    where: { id: couponId, ownerType: "MARKETPLACE", sellerId: null },
    select: { id: true, code: true, ownerType: true, fundedBy: true },
  });
}
