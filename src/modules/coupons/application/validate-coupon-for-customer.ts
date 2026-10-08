import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

type CouponClient = Pick<Prisma.TransactionClient, "coupon" | "couponRedemption">;

export type CouponLimitState = {
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  globalUsageLimit: number | null;
  perCustomerUsageLimit: number | null;
};

export type CouponAvailabilityProblem = "UNAVAILABLE" | "GLOBAL_LIMIT_REACHED" | "CUSTOMER_LIMIT_REACHED";

export function normalizeCouponCustomerEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Redemptions of the same customer: same e-mail (case-insensitive, so "A@x.com" and
 * "a@x.com" share the per-customer limit) or same signed-in user.
 */
export function couponCustomerUsageWhere(
  couponId: string,
  customerEmail: string,
  userId?: string,
): Prisma.CouponRedemptionWhereInput {
  return {
    couponId,
    OR: [
      { customerEmailSnapshot: { equals: normalizeCouponCustomerEmail(customerEmail), mode: "insensitive" } },
      ...(userId ? [{ userId }] : []),
    ],
  };
}

export function getCouponAvailabilityProblem(
  coupon: CouponLimitState,
  usage: { globalUsage: number; customerUsage: number },
  now: Date,
): CouponAvailabilityProblem | null {
  if (!coupon.active || (coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt < now))
    return "UNAVAILABLE";
  if (coupon.globalUsageLimit !== null && usage.globalUsage >= coupon.globalUsageLimit) return "GLOBAL_LIMIT_REACHED";
  if (coupon.perCustomerUsageLimit !== null && usage.customerUsage >= coupon.perCustomerUsageLimit)
    return "CUSTOMER_LIMIT_REACHED";
  return null;
}

async function countCouponUsage(
  client: CouponClient,
  coupon: { id: string } & CouponLimitState,
  customerEmail: string,
  userId?: string,
) {
  const [globalUsage, customerUsage] = await Promise.all([
    coupon.globalUsageLimit === null
      ? Promise.resolve(0)
      : client.couponRedemption.count({ where: { couponId: coupon.id } }),
    coupon.perCustomerUsageLimit === null
      ? Promise.resolve(0)
      : client.couponRedemption.count({ where: couponCustomerUsageWhere(coupon.id, customerEmail, userId) }),
  ]);
  return { globalUsage, customerUsage };
}

const availabilityMessages: Record<CouponAvailabilityProblem, string> = {
  UNAVAILABLE: "Cupom inválido ou expirado.",
  GLOBAL_LIMIT_REACHED: "O limite de uso deste cupom foi atingido.",
  CUSTOMER_LIMIT_REACHED: "Você já atingiu o limite de uso deste cupom.",
};

/** Pre-check outside the order transaction (friendly, specific messages). */
export async function findActiveCoupon(
  code: string | undefined,
  customerEmail: string,
  userId?: string,
  now: Date = new Date(),
) {
  if (!code) return undefined;
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon)
    throw new ApplicationError({ code: "CONFLICT", message: availabilityMessages.UNAVAILABLE, statusCode: 409 });
  const problem = getCouponAvailabilityProblem(coupon, await countCouponUsage(db, coupon, customerEmail, userId), now);
  if (problem)
    throw new ApplicationError({ code: "CONFLICT", message: availabilityMessages[problem], statusCode: 409 });
  return coupon;
}

export type ActiveCoupon = NonNullable<Awaited<ReturnType<typeof findActiveCoupon>>>;

/**
 * Locked recheck inside the order transaction: the coupon row is locked so concurrent
 * checkouts cannot both consume the last use, and any edit since the pre-check
 * (updatedAt) invalidates the computed discount.
 */
export async function assertCouponStillAvailableLocked(
  tx: Prisma.TransactionClient,
  snapshot: { id: string; updatedAt: Date },
  customerEmail: string,
  userId: string | undefined,
  now: Date,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "coupons" WHERE id = ${snapshot.id} FOR UPDATE`;
  const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: snapshot.id } });
  const [globalUsage, customerUsage] = await Promise.all([
    tx.couponRedemption.count({ where: { couponId: coupon.id } }),
    tx.couponRedemption.count({ where: couponCustomerUsageWhere(coupon.id, customerEmail, userId) }),
  ]);
  if (
    coupon.updatedAt.getTime() !== snapshot.updatedAt.getTime() ||
    getCouponAvailabilityProblem(coupon, { globalUsage, customerUsage }, now)
  ) {
    throw new ApplicationError({ code: "CONFLICT", message: "O cupom não está mais disponível.", statusCode: 409 });
  }
}
