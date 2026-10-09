"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAdminAccess, requireSellerAccess } from "@/modules/auth/application/authorization";
import { asApplicationError } from "@/shared/errors/application-error";

import { readCouponFormInput } from "../domain/coupon-form-input";

// Coupon amounts and limits are persisted as PostgreSQL int4.
const MAX_INT32 = 2_147_483_647;
const usageLimit = z.coerce
  .number({ error: "Informe o limite de uso como um número inteiro." })
  .int("Informe o limite de uso como um número inteiro.")
  .positive("O limite de uso precisa ser maior que zero.")
  .max(MAX_INT32, "O limite de uso informado é maior que o permitido.");

const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,40}$/, "Use de 3 a 40 caracteres: letras, números, _ ou -."),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"], { error: "Escolha o tipo de desconto." }),
  percentageBps: z
    .number({ error: "Informe o percentual com até duas casas, ex.: 10 ou 10,5." })
    .int()
    .min(1, "O percentual precisa ser maior que zero.")
    .max(10_000, "O percentual não pode passar de 100%.")
    .optional(),
  fixedAmountInCents: z
    .number({ error: "Informe o valor em reais, ex.: 25,90." })
    .int()
    .positive("O desconto precisa ser maior que zero.")
    .max(MAX_INT32, "O desconto informado é maior que o permitido.")
    .optional(),
  minimumPurchaseInCents: z
    .number({ error: "Informe a compra mínima em reais, ex.: 150,00." })
    .int()
    .min(0)
    .max(MAX_INT32, "A compra mínima informada é maior que a permitida."),
  globalUsageLimit: usageLimit.optional(),
  perCustomerUsageLimit: usageLimit.optional(),
});

export type CouponActionState = { error?: string; success?: string };

export async function createMarketplaceCouponAction(
  _previousState: CouponActionState,
  formData: FormData,
): Promise<CouponActionState> {
  const session = await requireAdminAccess();
  return createCoupon(formData, { ownerType: "MARKETPLACE", fundedBy: "MARKETPLACE", actorUserId: session.user.id });
}

export async function createSellerCouponAction(
  _previousState: CouponActionState,
  formData: FormData,
): Promise<CouponActionState> {
  const context = await requireSellerAccess("COUPON_MANAGE");
  return createCoupon(formData, {
    ownerType: "SELLER",
    fundedBy: "SELLER",
    sellerId: context.seller.id,
    actorUserId: context.session.user.id,
  });
}

const couponStatusSchema = z.object({ couponId: z.string().cuid(), active: z.boolean() });

export async function setMarketplaceCouponActiveAction(couponId: string, active: boolean): Promise<void> {
  const session = await requireAdminAccess();
  const input = couponStatusSchema.safeParse({ couponId, active });
  if (!input.success) return;
  await db.$transaction(async (tx) => {
    const coupon = await tx.coupon.findFirst({ where: { id: couponId, ownerType: "MARKETPLACE", sellerId: null } });
    if (!coupon) return;
    const result = await tx.coupon.updateMany({
      where: { id: coupon.id, ownerType: "MARKETPLACE", sellerId: null, active: !active },
      data: { active },
    });
    if (result.count !== 1) return;
    await tx.auditLog.create({
      data: {
        action: active ? "MARKETPLACE_COUPON_ACTIVATED" : "MARKETPLACE_COUPON_DEACTIVATED",
        entityType: "Coupon",
        entityId: coupon.id,
        metadata: { code: coupon.code, active },
        actorUserId: session.user.id,
      },
    });
  });
  revalidatePath("/admin", "layout");
}

export async function setSellerCouponActiveAction(couponId: string, active: boolean): Promise<void> {
  const context = await requireSellerAccess("COUPON_MANAGE");
  const input = couponStatusSchema.safeParse({ couponId, active });
  if (!input.success) return;
  await db.$transaction(async (tx) => {
    const coupon = await tx.coupon.findFirst({
      where: { id: couponId, ownerType: "SELLER", sellerId: context.seller.id },
    });
    if (!coupon) return;
    const result = await tx.coupon.updateMany({
      where: { id: coupon.id, ownerType: "SELLER", sellerId: context.seller.id, active: !active },
      data: { active },
    });
    if (result.count !== 1) return;
    await tx.auditLog.create({
      data: {
        action: active ? "SELLER_COUPON_ACTIVATED" : "SELLER_COUPON_DEACTIVATED",
        entityType: "Coupon",
        entityId: coupon.id,
        metadata: { code: coupon.code, active },
        actorUserId: context.session.user.id,
      },
    });
  });
  revalidatePath("/seller", "layout");
}

/** O tipo escolhido define qual valor de desconto é obrigatório. */
function readDiscountAmount(
  data: z.infer<typeof couponSchema>,
): { percentageBps: number } | { fixedAmountInCents: number } | { error: string } {
  if (data.discountType === "PERCENTAGE") {
    if (data.percentageBps === undefined) return { error: "Informe o percentual de desconto." };
    return { percentageBps: data.percentageBps };
  }

  if (data.fixedAmountInCents === undefined) return { error: "Informe o valor do desconto em reais." };
  return { fixedAmountInCents: data.fixedAmountInCents };
}

async function createCoupon(
  formData: FormData,
  owner: {
    ownerType: "MARKETPLACE" | "SELLER";
    fundedBy: "MARKETPLACE" | "SELLER";
    sellerId?: string;
    actorUserId: string;
  },
): Promise<CouponActionState> {
  const parsed = couponSchema.safeParse(readCouponFormInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do cupom." };
  const discountAmount = readDiscountAmount(parsed.data);
  if ("error" in discountAmount) return { error: discountAmount.error };

  try {
    const data = {
      code: parsed.data.code,
      ownerType: owner.ownerType,
      discountType: parsed.data.discountType,
      ...discountAmount,
      minimumPurchaseInCents: parsed.data.minimumPurchaseInCents,
      ...(parsed.data.globalUsageLimit !== undefined ? { globalUsageLimit: parsed.data.globalUsageLimit } : {}),
      ...(parsed.data.perCustomerUsageLimit !== undefined
        ? { perCustomerUsageLimit: parsed.data.perCustomerUsageLimit }
        : {}),
      fundedBy: owner.fundedBy,
    };
    await db.$transaction(async (tx) => {
      const coupon = owner.sellerId
        ? await tx.coupon.create({ data: { ...data, sellerId: owner.sellerId } })
        : await tx.coupon.create({ data });
      await tx.auditLog.create({
        data: {
          action: "COUPON_CREATED",
          entityType: "Coupon",
          entityId: coupon.id,
          actorUserId: owner.actorUserId,
          metadata: {
            code: data.code,
            ownerType: owner.ownerType,
            fundedBy: owner.fundedBy,
            sellerId: owner.sellerId ?? null,
            discountType: data.discountType,
            percentageBps: parsed.data.discountType === "PERCENTAGE" ? (parsed.data.percentageBps ?? null) : null,
            fixedAmountInCents:
              parsed.data.discountType === "FIXED_AMOUNT" ? (parsed.data.fixedAmountInCents ?? null) : null,
            minimumPurchaseInCents: data.minimumPurchaseInCents,
            globalUsageLimit: parsed.data.globalUsageLimit ?? null,
            perCustomerUsageLimit: parsed.data.perCustomerUsageLimit ?? null,
          },
        },
      });
    });
    revalidatePath(owner.ownerType === "MARKETPLACE" ? "/admin" : "/seller", "layout");
    return { success: `Cupom ${parsed.data.code} criado.` };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Já existe um cupom com este código." };
    }
    return { error: asApplicationError(error).message };
  }
}
