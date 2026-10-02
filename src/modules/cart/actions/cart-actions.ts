"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";

import { cartOwnerWhere, findOrCreateActiveCart, getCartIdentity } from "../infrastructure/cart-access";

const cartItemSchema = z.object({
  variantId: z.string().cuid(),
  quantity: z.number().int().min(1).max(99),
});

export type CartActionState = { error?: string; success?: string };

export async function addToCartAction(variantId: string, quantity: number): Promise<CartActionState> {
  const parsed = cartItemSchema.safeParse({ variantId, quantity });
  if (!parsed.success) return { error: "Escolha uma quantidade válida." };

  try {
    const identity = await getCartIdentity(true);
    if (!identity) throw new ApplicationError({ code: "UNAUTHORIZED", message: "Não foi possível abrir o carrinho." });

    const variant = await db.productVariant.findFirst({
      where: {
        id: parsed.data.variantId,
        active: true,
        product: {
          status: ProductStatus.APPROVED,
          isDemo: false,
          seller: { status: { in: ["APPROVED", "ACTIVE"] } },
          category: { active: true },
          brand: { active: true },
        },
      },
      include: { inventory: true },
    });
    if (!variant) throw new ApplicationError({ code: "NOT_FOUND", message: "Esta variante não está disponível." });

    const cart = await findOrCreateActiveCart(identity);
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "carts" WHERE id = ${cart.id} FOR UPDATE`;
      const active = await tx.cart.findFirst({ where: { id: cart.id, ...cartOwnerWhere(identity), status: "ACTIVE" } });
      if (!active)
        throw new ApplicationError({ code: "CONFLICT", message: "O carrinho já foi finalizado. Atualize a página." });
      const item = await tx.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId } } });
      const nextQuantity = (item?.quantity ?? 0) + parsed.data.quantity;
      if (nextQuantity > 99)
        throw new ApplicationError({ code: "VALIDATION_ERROR", message: "O limite por item é de 99 unidades." });
      if ((variant.inventory?.availableQuantity ?? 0) < nextQuantity) {
        throw new ApplicationError({
          code: "OUT_OF_STOCK",
          message: "A quantidade solicitada não está disponível.",
          statusCode: 409,
        });
      }

      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId } },
        create: { cartId: cart.id, variantId, quantity: parsed.data.quantity },
        update: { quantity: nextQuantity },
      });
    });

    revalidatePath("/cart");
    return { success: "Produto adicionado ao carrinho." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function updateCartItemAction(cartItemId: string, quantity: number): Promise<CartActionState> {
  const parsed = z.object({ cartItemId: z.string().cuid(), quantity: z.number().int().min(0).max(99) }).safeParse({
    cartItemId,
    quantity,
  });
  if (!parsed.success) return { error: "Quantidade inválida." };

  try {
    const identity = await getCartIdentity();
    if (!identity) throw new ApplicationError({ code: "NOT_FOUND", message: "Carrinho não encontrado." });
    await db.$transaction(async (tx) => {
      const target = await tx.cartItem.findFirst({
        where: { id: cartItemId, cart: { ...cartOwnerWhere(identity), status: "ACTIVE" } },
        select: { cartId: true },
      });
      if (!target) throw new ApplicationError({ code: "NOT_FOUND", message: "Item não encontrado no carrinho." });
      await tx.$queryRaw`SELECT id FROM "carts" WHERE id = ${target.cartId} FOR UPDATE`;
      const item = await tx.cartItem.findFirst({
        where: { id: cartItemId, cart: { ...cartOwnerWhere(identity), status: "ACTIVE" } },
        include: { variant: { include: { inventory: true } } },
      });
      if (!item) throw new ApplicationError({ code: "NOT_FOUND", message: "Item não encontrado no carrinho." });

      if (parsed.data.quantity === 0) {
        await tx.cartItem.delete({ where: { id: item.id } });
      } else {
        if ((item.variant.inventory?.availableQuantity ?? 0) < parsed.data.quantity) {
          throw new ApplicationError({
            code: "OUT_OF_STOCK",
            message: "A quantidade solicitada não está disponível.",
            statusCode: 409,
          });
        }
        await tx.cartItem.update({ where: { id: item.id }, data: { quantity: parsed.data.quantity } });
      }
    });
    revalidatePath("/cart");
    revalidatePath("/checkout");
    return { success: "Carrinho atualizado." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function removeCartItemAction(cartItemId: string): Promise<CartActionState> {
  return updateCartItemAction(cartItemId, 0);
}

export async function getCartPreviewAction(): Promise<{
  items: {
    id: string;
    name: string;
    variant: string;
    quantity: number;
    availableQuantity: number;
    unitPriceInCents: number;
  }[];
  itemCount: number;
  subtotalInCents: number;
  error?: string;
}> {
  try {
    const identity = await getCartIdentity();
    if (!identity) return { items: [], itemCount: 0, subtotalInCents: 0 };
    const cart = await db.cart.findFirst({
      where: { ...cartOwnerWhere(identity), status: "ACTIVE" },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: { variant: { include: { inventory: true, product: { select: { name: true } } } } },
        },
      },
    });
    const items = (cart?.items ?? []).map((item) => ({
      id: item.id,
      name: item.variant.product.name,
      variant: item.variant.title,
      quantity: item.quantity,
      availableQuantity: item.variant.inventory?.availableQuantity ?? 0,
      unitPriceInCents: getCurrentPriceInCents(item.variant),
    }));
    return {
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotalInCents: items.reduce((total, item) => total + item.unitPriceInCents * item.quantity, 0),
    };
  } catch {
    return { items: [], itemCount: 0, subtotalInCents: 0, error: "Não foi possível carregar o carrinho." };
  }
}

export async function clearCartAction(): Promise<CartActionState> {
  try {
    const identity = await getCartIdentity();
    if (!identity) return { error: "Carrinho não encontrado." };
    await db.$transaction(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: { ...cartOwnerWhere(identity), status: "ACTIVE" },
        select: { id: true },
      });
      if (!cart) return;
      await tx.$queryRaw`SELECT id FROM "carts" WHERE id = ${cart.id} FOR UPDATE`;
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id, cart: { ...cartOwnerWhere(identity), status: "ACTIVE" } },
      });
    });
    revalidatePath("/cart");
    revalidatePath("/checkout");
    return { success: "Carrinho esvaziado." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
