import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

import { canonicalCouponCustomerEmail, type CouponCustomer } from "../domain/coupon-customer-key";

export type { CouponCustomer } from "../domain/coupon-customer-key";

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
 * Redemptions of the same customer (M-07): same canonical e-mail (case, "+tag" and Gmail dots
 * ignored), same signed-in user, or an order with the same CPF. Rows created before the
 * canonical key existed still match by the case-insensitive e-mail.
 */
export function couponCustomerUsageWhere(
  couponId: string,
  customer: CouponCustomer,
): Prisma.CouponRedemptionWhereInput {
  return {
    couponId,
    OR: [
      { customerEmailKey: canonicalCouponCustomerEmail(customer.email) },
      { customerEmailSnapshot: { equals: normalizeCouponCustomerEmail(customer.email), mode: "insensitive" } },
      ...(customer.userId ? [{ userId: customer.userId }] : []),
      ...(customer.taxId ? [{ order: { customerTaxId: customer.taxId } }] : []),
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
  customer: CouponCustomer,
) {
  const [globalUsage, customerUsage] = await Promise.all([
    coupon.globalUsageLimit === null
      ? Promise.resolve(0)
      : client.couponRedemption.count({ where: { couponId: coupon.id } }),
    coupon.perCustomerUsageLimit === null
      ? Promise.resolve(0)
      : client.couponRedemption.count({ where: couponCustomerUsageWhere(coupon.id, customer) }),
  ]);
  return { globalUsage, customerUsage };
}

const availabilityMessages: Record<CouponAvailabilityProblem, string> = {
  UNAVAILABLE: "Cupom inválido ou expirado.",
  GLOBAL_LIMIT_REACHED: "O limite de uso deste cupom foi atingido.",
  CUSTOMER_LIMIT_REACHED: "Você já atingiu o limite de uso deste cupom.",
};

/** Pre-check outside the order transaction (friendly, specific messages). */
export async function findActiveCoupon(code: string | undefined, customer: CouponCustomer, now: Date = new Date()) {
  if (!code) return undefined;
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon)
    throw new ApplicationError({ code: "CONFLICT", message: availabilityMessages.UNAVAILABLE, statusCode: 409 });
  const problem = getCouponAvailabilityProblem(coupon, await countCouponUsage(db, coupon, customer), now);
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
  customer: CouponCustomer,
  now: Date,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "coupons" WHERE id = ${snapshot.id} FOR UPDATE`;
  const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: snapshot.id } });
  const [globalUsage, customerUsage] = await Promise.all([
    tx.couponRedemption.count({ where: { couponId: coupon.id } }),
    tx.couponRedemption.count({ where: couponCustomerUsageWhere(coupon.id, customer) }),
  ]);
  if (
    coupon.updatedAt.getTime() !== snapshot.updatedAt.getTime() ||
    getCouponAvailabilityProblem(coupon, { globalUsage, customerUsage }, now)
  ) {
    throw new ApplicationError({ code: "CONFLICT", message: "O cupom não está mais disponível.", statusCode: 409 });
  }
}
