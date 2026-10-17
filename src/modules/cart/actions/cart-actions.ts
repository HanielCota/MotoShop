"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";
import { logActionFailure, toActionError } from "@/shared/errors/action-error";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";
import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";
import { getClientIp } from "@/shared/request/client-ip";

import {
  addCartItem,
  clearActiveCart,
  MAX_CART_ITEM_QUANTITY,
  updateCartItemQuantity,
} from "../application/cart-items";
import { cartOwnerWhere, getCartIdentity } from "../infrastructure/cart-access";

const cartItemSchema = z.object({
  variantId: z.string().cuid(),
  quantity: z.number().int().min(1).max(MAX_CART_ITEM_QUANTITY),
});

export type CartActionState = { error?: string; success?: string };

export async function addToCartAction(variantId: string, quantity: number): Promise<CartActionState> {
  const parsed = cartItemSchema.safeParse({ variantId, quantity });
  if (!parsed.success) return { error: "Escolha uma quantidade válida." };

  try {
    // Without a cookie every call opens a new cart, so the limit follows the client IP (M-06).
    await assertRateLimit({ key: `cart-add:ip:${getClientIp(await headers())}`, windowSeconds: 60, max: 60 });
    const identity = await getCartIdentity(true);
    if (!identity) throw new ApplicationError({ code: "UNAUTHORIZED", message: "Não foi possível abrir o carrinho." });
    await addCartItem({ identity, variantId: parsed.data.variantId, quantity: parsed.data.quantity });
    revalidatePath("/cart");
    return { success: "Produto adicionado ao carrinho." };
  } catch (error) {
    return { error: toActionError(error, "addToCartAction").message };
  }
}

export async function updateCartItemAction(cartItemId: string, quantity: number): Promise<CartActionState> {
  const parsed = z
    .object({ cartItemId: z.string().cuid(), quantity: z.number().int().min(0).max(MAX_CART_ITEM_QUANTITY) })
    .safeParse({ cartItemId, quantity });
  if (!parsed.success) return { error: "Quantidade inválida." };

  try {
    const identity = await getCartIdentity();
    if (!identity) throw new ApplicationError({ code: "NOT_FOUND", message: "Carrinho não encontrado." });
    await updateCartItemQuantity({ identity, cartItemId: parsed.data.cartItemId, quantity: parsed.data.quantity });
    revalidatePath("/cart");
    revalidatePath("/checkout");
    return { success: "Carrinho atualizado." };
  } catch (error) {
    return { error: toActionError(error, "updateCartItemAction").message };
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
          include: {
            variant: { include: { inventory: true, product: { select: { name: true } } } },
          },
        },
      },
    });
    const cartItems = cart?.items ?? [];
    const items = cartItems.map((item) => ({
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
  } catch (error) {
    logActionFailure("getCartPreviewAction", error);
    return {
      items: [],
      itemCount: 0,
      subtotalInCents: 0,
      error: "Não foi possível carregar o carrinho.",
    };
  }
}

export async function clearCartAction(): Promise<CartActionState> {
  try {
    const identity = await getCartIdentity();
    if (!identity) return { error: "Carrinho não encontrado." };
    await clearActiveCart(identity);
    revalidatePath("/cart");
    revalidatePath("/checkout");
    return { success: "Carrinho limpo." };
  } catch (error) {
    return { error: toActionError(error, "clearCartAction").message };
  }
}
