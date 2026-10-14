"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { parsePriceInputToCents } from "@/modules/products/domain/price-input";
import { toActionError } from "@/shared/errors/action-error";
import { createOwnShippingMethod, setOwnShippingMethodActive, advanceOwnShipment } from "../application/own-shipping";
import { ownShippingMethodSchema } from "../domain/own-shipping";

export type OwnShippingState = { error?: string; success?: string };
export async function createOwnShippingMethodAction(_: OwnShippingState, form: FormData): Promise<OwnShippingState> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const data = ownShippingMethodSchema.safeParse({
    ...Object.fromEntries(form),
    priceInCents: parsePriceInputToCents(form.get("price") ?? undefined),
  });
  if (!data.success) {
    return { error: data.error.issues[0]?.message ?? "Confira o nome, os CEPs, o valor e o prazo de entrega." };
  }
  try {
    await createOwnShippingMethod(context.seller.id, context.session.user.id, data.data);
    revalidatePath("/seller/shipping");
    return { success: "Modalidade criada. Ative-a quando estiver pronta para atender esta região." };
  } catch (error) {
    return { error: toActionError(error, "createOwnShippingMethodAction").message };
  }
}

export async function setOwnShippingMethodActiveAction(_: OwnShippingState, form: FormData): Promise<OwnShippingState> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const data = z.object({ id: z.cuid(), active: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(form));
  if (!data.success) return { error: "Modalidade inválida." };
  try {
    await setOwnShippingMethodActive(
      context.seller.id,
      context.session.user.id,
      data.data.id,
      data.data.active === "true",
    );
    revalidatePath("/seller/shipping");
    return { success: "Disponibilidade atualizada." };
  } catch (error) {
    return { error: toActionError(error, "setOwnShippingMethodActiveAction").message };
  }
}

export async function advanceOwnShipmentAction(_: OwnShippingState, form: FormData): Promise<OwnShippingState> {
  const context = await requireSellerAccess("ORDER_UPDATE");
  const data = z
    .object({
      sellerOrderId: z.cuid(),
      status: z.enum(["SHIPPED", "DELIVERED"]),
      trackingCode: z.string().trim().max(100).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!data.success) return { error: "Dados da entrega inválidos." };
  try {
    await advanceOwnShipment({ ...data.data, sellerId: context.seller.id, actorUserId: context.session.user.id });
    revalidatePath("/seller/orders");
    revalidatePath("/orders", "layout");
    return { success: "Entrega atualizada." };
  } catch (error) {
    return { error: toActionError(error, "advanceOwnShipmentAction").message };
  }
}
