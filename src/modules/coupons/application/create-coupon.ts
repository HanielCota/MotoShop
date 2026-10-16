import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/database";

export type CouponOwner = {
  ownerType: "MARKETPLACE" | "SELLER";
  fundedBy: "MARKETPLACE" | "SELLER";
  sellerId?: string;
  actorUserId: string;
};

export type CouponDiscountAmount = { percentageBps: number } | { fixedAmountInCents: number };

export type CreateCouponInput = {
  code: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  percentageBps?: number | undefined;
  fixedAmountInCents?: number | undefined;
  minimumPurchaseInCents: number;
  globalUsageLimit?: number | undefined;
  perCustomerUsageLimit?: number | undefined;
  /** Só vale para cupom de loja; cupom do Moto Shop nunca é divulgado na página do produto. */
  showOnProductPage?: boolean | undefined;
  /** Início e fim da validade em UTC; vazio deixa o limite aberto (BUG-025). */
  startsAt?: Date | undefined;
  endsAt?: Date | undefined;
};

/** Creates a coupon for its owner and records the audit entry in the same transaction. */
export async function createCoupon(
  owner: CouponOwner,
  input: CreateCouponInput,
  discountAmount: CouponDiscountAmount,
): Promise<void> {
  const data = toCouponData(owner, input, discountAmount);

  await db.$transaction(async (tx) => {
    const coupon = owner.sellerId
      ? await tx.coupon.create({ data: { ...data, sellerId: owner.sellerId } })
      : await tx.coupon.create({ data });
    await recordCouponCreatedAudit(tx, { couponId: coupon.id, owner, input });
  });
}

function toCouponData(owner: CouponOwner, input: CreateCouponInput, discountAmount: CouponDiscountAmount) {
  return {
    code: input.code,
    ownerType: owner.ownerType,
    discountType: input.discountType,
    ...discountAmount,
    minimumPurchaseInCents: input.minimumPurchaseInCents,
    ...(input.globalUsageLimit !== undefined ? { globalUsageLimit: input.globalUsageLimit } : {}),
    ...(input.perCustomerUsageLimit !== undefined ? { perCustomerUsageLimit: input.perCustomerUsageLimit } : {}),
    ...(input.startsAt ? { startsAt: input.startsAt } : {}),
    ...(input.endsAt ? { endsAt: input.endsAt } : {}),
    fundedBy: owner.fundedBy,
    showOnProductPage: owner.ownerType === "SELLER" && input.showOnProductPage === true,
  };
}

async function recordCouponCreatedAudit(
  tx: Prisma.TransactionClient,
  entry: { couponId: string; owner: CouponOwner; input: CreateCouponInput },
): Promise<void> {
  const { couponId, owner, input } = entry;
  await tx.auditLog.create({
    data: {
      action: "COUPON_CREATED",
      entityType: "Coupon",
      entityId: couponId,
      actorUserId: owner.actorUserId,
      metadata: {
        code: input.code,
        ownerType: owner.ownerType,
        fundedBy: owner.fundedBy,
        sellerId: owner.sellerId ?? null,
        discountType: input.discountType,
        percentageBps: input.discountType === "PERCENTAGE" ? (input.percentageBps ?? null) : null,
        fixedAmountInCents: input.discountType === "FIXED_AMOUNT" ? (input.fixedAmountInCents ?? null) : null,
        minimumPurchaseInCents: input.minimumPurchaseInCents,
        globalUsageLimit: input.globalUsageLimit ?? null,
        perCustomerUsageLimit: input.perCustomerUsageLimit ?? null,
        showOnProductPage: owner.ownerType === "SELLER" && input.showOnProductPage === true,
        startsAt: input.startsAt?.toISOString() ?? null,
        endsAt: input.endsAt?.toISOString() ?? null,
      },
    },
  });
}
