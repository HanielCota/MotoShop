"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAdminAccess, requireSellerAccess } from "@/modules/auth/application/authorization";
import { asApplicationError } from "@/shared/errors/application-error";

const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,40}$/, "Use de 3 a 40 caracteres: letras, números, _ ou -."),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  percentageBps: z.coerce.number().int().min(1).max(10_000).optional(),
  fixedAmountInCents: z.coerce.number().int().positive().optional(),
  minimumPurchaseInCents: z.coerce.number().int().min(0),
  globalUsageLimit: z.coerce.number().int().positive().optional(),
  perCustomerUsageLimit: z.coerce.number().int().positive().optional(),
});

export type CouponActionState = { error?: string; success?: string };

export async function createMarketplaceCouponAction(
  _previousState: CouponActionState,
  formData: FormData,
): Promise<CouponActionState> {
  await requireAdminAccess();
  return createCoupon(formData, { ownerType: "MARKETPLACE", fundedBy: "MARKETPLACE" });
}

export async function createSellerCouponAction(
  _previousState: CouponActionState,
  formData: FormData,
): Promise<CouponActionState> {
  const context = await requireSellerAccess("COUPON_MANAGE");
  return createCoupon(formData, { ownerType: "SELLER", fundedBy: "SELLER", sellerId: context.seller.id });
}

export async function setMarketplaceCouponActiveAction(couponId: string, active: boolean): Promise<void> {
  const session = await requireAdminAccess();
  const coupon = await db.coupon.findFirst({ where: { id: couponId, ownerType: "MARKETPLACE", sellerId: null } });
  if (!coupon) return;
  await db.$transaction([
    db.coupon.update({ where: { id: coupon.id }, data: { active } }),
    db.auditLog.create({
      data: {
        action: active ? "MARKETPLACE_COUPON_ACTIVATED" : "MARKETPLACE_COUPON_DEACTIVATED",
        entityType: "Coupon",
        entityId: coupon.id,
        metadata: { code: coupon.code, active },
        actorUserId: session.user.id,
      },
    }),
  ]);
  revalidatePath("/admin");
}

export async function setSellerCouponActiveAction(couponId: string, active: boolean): Promise<void> {
  const context = await requireSellerAccess("COUPON_MANAGE");
  const coupon = await db.coupon.findFirst({
    where: { id: couponId, ownerType: "SELLER", sellerId: context.seller.id },
  });
  if (!coupon) return;
  await db.$transaction([
    db.coupon.update({ where: { id: coupon.id }, data: { active } }),
    db.auditLog.create({
      data: {
        action: active ? "SELLER_COUPON_ACTIVATED" : "SELLER_COUPON_DEACTIVATED",
        entityType: "Coupon",
        entityId: coupon.id,
        metadata: { code: coupon.code, active },
        actorUserId: context.session.user.id,
      },
    }),
  ]);
  revalidatePath("/seller");
}

async function createCoupon(
  formData: FormData,
  owner: { ownerType: "MARKETPLACE" | "SELLER"; fundedBy: "MARKETPLACE" | "SELLER"; sellerId?: string },
): Promise<CouponActionState> {
  const parsed = couponSchema.safeParse({
    code: formData.get("code"),
    discountType: formData.get("discountType"),
    percentageBps: formData.get("percentageBps") || undefined,
    fixedAmountInCents: formData.get("fixedAmountInCents") || undefined,
    minimumPurchaseInCents: formData.get("minimumPurchaseInCents") || 0,
    globalUsageLimit: formData.get("globalUsageLimit") || undefined,
    perCustomerUsageLimit: formData.get("perCustomerUsageLimit") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do cupom." };
  if (parsed.data.discountType === "PERCENTAGE" && parsed.data.percentageBps === undefined)
    return { error: "Informe o percentual em basis points." };
  if (parsed.data.discountType === "FIXED_AMOUNT" && parsed.data.fixedAmountInCents === undefined)
    return { error: "Informe o desconto fixo em centavos." };

  try {
    const data = {
      code: parsed.data.code,
      ownerType: owner.ownerType,
      discountType: parsed.data.discountType,
      ...(parsed.data.discountType === "PERCENTAGE"
        ? { percentageBps: parsed.data.percentageBps! }
        : { fixedAmountInCents: parsed.data.fixedAmountInCents! }),
      minimumPurchaseInCents: parsed.data.minimumPurchaseInCents,
      ...(parsed.data.globalUsageLimit !== undefined ? { globalUsageLimit: parsed.data.globalUsageLimit } : {}),
      ...(parsed.data.perCustomerUsageLimit !== undefined
        ? { perCustomerUsageLimit: parsed.data.perCustomerUsageLimit }
        : {}),
      fundedBy: owner.fundedBy,
    };
    if (owner.sellerId) {
      await db.coupon.create({ data: { ...data, sellerId: owner.sellerId } });
    } else {
      await db.coupon.create({ data });
    }
    revalidatePath(owner.ownerType === "MARKETPLACE" ? "/admin" : "/seller");
    return { success: `Cupom ${parsed.data.code} criado.` };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Já existe um cupom com este código." };
    }
    return { error: asApplicationError(error).message };
  }
}
