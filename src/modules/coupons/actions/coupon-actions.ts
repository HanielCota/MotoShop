"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAdminAccess, requireSellerAccess } from "@/modules/auth/application/authorization";
import { toActionError } from "@/shared/errors/action-error";
import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";

import { createCoupon, type CouponOwner } from "../application/create-coupon";
import { setCouponParticipation } from "../application/set-coupon-participation";
import { parseCouponForm } from "../schemas/coupon-input";

export type CouponActionState = { error?: string; success?: string; field?: string | undefined };

const COUPON_CODE_UNAVAILABLE_MESSAGE = "Este código não está disponível. Escolha outro.";
// Limita tentativas de criar cupom por loja para que o código único não sirva de oráculo (L-10).
const SELLER_COUPON_CREATION_LIMIT = { windowSeconds: 60 * 60, max: 20 };

// "Campanha com adesão" (paid by each seller that joins) is the default; "Cupom Moto Shop" is paid by the marketplace.
const marketplaceCouponKindSchema = z
  .enum(["SELLER_FUNDED_CAMPAIGN", "MARKETPLACE"], { error: "Escolha quem paga o desconto do cupom." })
  .default("SELLER_FUNDED_CAMPAIGN");

export async function createMarketplaceCouponAction(
  _previousState: CouponActionState,
  formData: FormData,
): Promise<CouponActionState> {
  const session = await requireAdminAccess();
  const kind = marketplaceCouponKindSchema.safeParse(formData.get("couponKind") ?? undefined);
  if (!kind.success) return { error: kind.error.issues[0]?.message ?? "Escolha quem paga o desconto do cupom." };

  return createCouponForOwner(formData, {
    ownerType: "MARKETPLACE",
    fundedBy: kind.data === "MARKETPLACE" ? "MARKETPLACE" : "SELLER",
    actorUserId: session.user.id,
  });
}

export async function createSellerCouponAction(
  _previousState: CouponActionState,
  formData: FormData,
): Promise<CouponActionState> {
  const context = await requireSellerAccess("COUPON_MANAGE");
  try {
    await assertRateLimit({ key: `seller-coupon-create:${context.seller.id}`, ...SELLER_COUPON_CREATION_LIMIT });
  } catch (error) {
    return { error: toActionError(error, "createSellerCouponAction").message };
  }
  return createCouponForOwner(formData, {
    ownerType: "SELLER",
    fundedBy: "SELLER",
    sellerId: context.seller.id,
    actorUserId: context.session.user.id,
  });
}

const couponStatusSchema = z.object({ couponId: z.string().cuid(), active: z.boolean() });
const couponIdSchema = z.cuid();

/** The seller joins a Moto Shop campaign: the campaign discount then comes out of its own items. */
export async function joinMarketplaceCouponAction(couponId: string): Promise<CouponActionState> {
  return setCampaignParticipation(couponId, true);
}

/** The seller leaves a campaign; only later checkouts stop applying it to its items. */
export async function leaveMarketplaceCouponAction(couponId: string): Promise<CouponActionState> {
  return setCampaignParticipation(couponId, false);
}

async function setCampaignParticipation(couponId: string, participate: boolean): Promise<CouponActionState> {
  const context = await requireSellerAccess("COUPON_MANAGE");
  const parsedCouponId = couponIdSchema.safeParse(couponId);
  if (!parsedCouponId.success) return { error: "Campanha inválida." };

  try {
    await setCouponParticipation({
      sellerId: context.seller.id,
      userId: context.session.user.id,
      couponId: parsedCouponId.data,
      participate,
    });
    revalidatePath("/seller", "layout");
    return { success: participate ? "Sua loja entrou na campanha." : "Sua loja saiu da campanha." };
  } catch (error) {
    return {
      error: toActionError(error, participate ? "joinMarketplaceCouponAction" : "leaveMarketplaceCouponAction").message,
    };
  }
}

const couponProductPageSchema = z.object({ couponId: z.string().cuid(), show: z.boolean() });

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

/** Liga ou desliga a divulgação de um cupom da própria loja na página do produto. */
export async function setSellerCouponProductPageAction(couponId: string, show: boolean): Promise<void> {
  const context = await requireSellerAccess("COUPON_MANAGE");
  const input = couponProductPageSchema.safeParse({ couponId, show });
  if (!input.success) return;
  await db.$transaction(async (tx) => {
    const coupon = await tx.coupon.findFirst({
      where: { id: couponId, ownerType: "SELLER", sellerId: context.seller.id },
    });
    if (!coupon) return;
    const result = await tx.coupon.updateMany({
      where: { id: coupon.id, ownerType: "SELLER", sellerId: context.seller.id, showOnProductPage: !show },
      data: { showOnProductPage: show },
    });
    if (result.count !== 1) return;
    await tx.auditLog.create({
      data: {
        action: show ? "SELLER_COUPON_SHOWN_ON_PRODUCT_PAGE" : "SELLER_COUPON_HIDDEN_FROM_PRODUCT_PAGE",
        entityType: "Coupon",
        entityId: coupon.id,
        metadata: { code: coupon.code, showOnProductPage: show },
        actorUserId: context.session.user.id,
      },
    });
  });
  revalidatePath("/seller", "layout");
  revalidatePath("/products", "layout");
}

async function createCouponForOwner(formData: FormData, owner: CouponOwner): Promise<CouponActionState> {
  const parsed = parseCouponForm(formData);
  if (!parsed.ok) return { error: parsed.error, field: parsed.field };
  const { data, discountAmount } = parsed;

  try {
    await createCoupon(owner, data, discountAmount);

    revalidatePath(owner.ownerType === "MARKETPLACE" ? "/admin" : "/seller", "layout");
    return { success: `Cupom ${data.code} criado.` };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Mensagem neutra (L-10): não confirma se o código pertence a outra loja ou ao Moto Shop.
      return { error: COUPON_CODE_UNAVAILABLE_MESSAGE, field: "code" };
    }
    return { error: toActionError(error, "createCouponForOwner").message };
  }
}
