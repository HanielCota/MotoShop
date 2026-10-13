/**
 * Review demo additions of 13/10/2026: structured variant columns, coupons shown on the
 * product page and one Moto Shop campaign with a seller opt-in. Idempotent and limited to
 * review data (`REVIEW-*` SKUs and codes, demo products).
 *
 * Requires migrations 20261013120000 (variant columns), 20261013150000 (showOnProductPage) and
 * 20261013160000 (coupon_seller_participations) applied to the target database.
 */
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { inferVariantColumns } from "./review-seed-variant-attributes";

type Track = (entity: string, created: number, total: number) => void;
type ReviewSellers = { garagem: string; box77: string };

const DAY = 24 * 60 * 60 * 1000;

/** Fills gender/color/size only on demo variants whose three columns are still empty. */
export async function ensureReviewVariantColumns(db: PrismaClient, track: Track): Promise<void> {
  const variants = await db.productVariant.findMany({
    where: {
      sku: { startsWith: "REVIEW-" },
      product: { isDemo: true },
      gender: null,
      color: null,
      size: null,
    },
    select: { id: true, attributes: true, product: { select: { name: true } } },
  });

  let updated = 0;
  for (const variant of variants) {
    const columns = inferVariantColumns({ productName: variant.product.name, attributes: variant.attributes });
    if (!columns) continue;
    await db.productVariant.update({ where: { id: variant.id }, data: columns });
    updated += 1;
  }
  track("ProductVariant (gender/color/size)", updated, variants.length);
}

function productPageCoupons(sellers: ReviewSellers, now: Date): Prisma.CouponUncheckedCreateInput[] {
  return [
    {
      code: "REVIEW-GARAGEM-PRODUTO10",
      ownerType: "SELLER",
      discountType: "PERCENTAGE",
      percentageBps: 1000,
      minimumPurchaseInCents: 0,
      startsAt: new Date(now.getTime() - 2 * DAY),
      endsAt: new Date(now.getTime() + 45 * DAY),
      fundedBy: "SELLER",
      sellerId: sellers.garagem,
      showOnProductPage: true,
    },
    {
      code: "REVIEW-BOX77-PECAS25",
      ownerType: "SELLER",
      discountType: "FIXED_AMOUNT",
      fixedAmountInCents: 2500,
      minimumPurchaseInCents: 15000,
      startsAt: new Date(now.getTime() - 2 * DAY),
      endsAt: null,
      perCustomerUsageLimit: 1,
      fundedBy: "SELLER",
      sellerId: sellers.box77,
      showOnProductPage: true,
    },
  ];
}

function campaignCoupon(now: Date): Prisma.CouponUncheckedCreateInput {
  return {
    code: "REVIEW-CAMPANHA-OFFROAD8",
    ownerType: "MARKETPLACE",
    discountType: "PERCENTAGE",
    percentageBps: 800,
    minimumPurchaseInCents: 20000,
    startsAt: new Date(now.getTime() - 1 * DAY),
    endsAt: new Date(now.getTime() + 30 * DAY),
    // Campanha com adesão: paid by each seller that joins, valid only on their items.
    fundedBy: "SELLER",
  };
}

async function ensureCoupon(db: PrismaClient, data: Prisma.CouponUncheckedCreateInput) {
  const existing = await db.coupon.findUnique({ where: { code: data.code }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };

  const coupon = await db.coupon.create({ data, select: { id: true } });
  return { id: coupon.id, created: true };
}

/**
 * Two seller coupons shown on the product page and one campaign joined by Garagem MX.
 * Existing rows are left as they are, so changes made on screen during the review survive.
 */
export async function ensureReviewCouponsAndCampaign(
  db: PrismaClient,
  input: { sellers: ReviewSellers; now: Date; track: Track },
): Promise<void> {
  const { sellers, now, track } = input;
  const coupons = [...productPageCoupons(sellers, now), campaignCoupon(now)];
  let created = 0;
  let campaignId = "";
  for (const data of coupons) {
    const coupon = await ensureCoupon(db, data);
    if (coupon.created) created += 1;
    if (data.fundedBy === "SELLER" && data.ownerType === "MARKETPLACE") campaignId = coupon.id;
  }
  track("Coupon (product page + campaign)", created, coupons.length);

  const participation = await db.couponSellerParticipation.findUnique({
    where: { couponId_sellerId: { couponId: campaignId, sellerId: sellers.garagem } },
    select: { id: true },
  });
  if (!participation)
    await db.couponSellerParticipation.create({
      data: { couponId: campaignId, sellerId: sellers.garagem, joinedAt: now },
    });
  track("CouponSellerParticipation", participation ? 0 : 1, 1);
}
