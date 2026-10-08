import "server-only";

import { db } from "@/lib/database";
import { purchasableVariantWhere } from "@/modules/products/application/purchasable-variant";
import { ApplicationError } from "@/shared/errors/application-error";

import { cartOwnerWhere, findOrCreateActiveCart, type CartIdentity } from "../infrastructure/cart-access";
import { MAX_CART_ITEM_QUANTITY } from "./merge-guest-cart";

export { MAX_CART_ITEM_QUANTITY };

function outOfStock() {
  return new ApplicationError({
    code: "OUT_OF_STOCK",
    message: "A quantidade solicitada não está disponível.",
    statusCode: 409,
  });
}

/** Adds `quantity` units, enforcing the per-item limit on the combined quantity and current stock. */
export async function addCartItem(input: { identity: CartIdentity; variantId: string; quantity: number }) {
  const { identity, variantId, quantity } = input;
  const variant = await db.productVariant.findFirst({
    where: purchasableVariantWhere(variantId),
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
    const nextQuantity = (item?.quantity ?? 0) + quantity;
    if (nextQuantity > MAX_CART_ITEM_QUANTITY)
      throw new ApplicationError({ code: "VALIDATION_ERROR", message: "O limite por item é de 99 unidades." });
    if ((variant.inventory?.availableQuantity ?? 0) < nextQuantity) throw outOfStock();

    await tx.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      create: { cartId: cart.id, variantId, quantity },
      update: { quantity: nextQuantity },
    });
  });
}

/** Sets an item's quantity (0 removes it) after locking the cart and re-checking ownership. */
export async function updateCartItemQuantity(input: { identity: CartIdentity; cartItemId: string; quantity: number }) {
  const { identity, cartItemId, quantity } = input;
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

    if (quantity === 0) {
      await tx.cartItem.delete({ where: { id: item.id } });
      return;
    }
    if ((item.variant.inventory?.availableQuantity ?? 0) < quantity) throw outOfStock();
    await tx.cartItem.update({ where: { id: item.id }, data: { quantity } });
  });
}

/**
 * Remove todos os itens do carrinho ATIVO do dono atual (usuário ou visitante), com lock
 * e nova checagem de ownership. Retorna quantos itens foram removidos.
 */
export async function clearActiveCart(identity: CartIdentity): Promise<number> {
  return db.$transaction(async (tx) => {
    const cart = await tx.cart.findFirst({
      where: { ...cartOwnerWhere(identity), status: "ACTIVE" },
      select: { id: true },
    });
    if (!cart) return 0;
    await tx.$queryRaw`SELECT id FROM "carts" WHERE id = ${cart.id} FOR UPDATE`;
    const removed = await tx.cartItem.deleteMany({
      where: { cartId: cart.id, cart: { ...cartOwnerWhere(identity), status: "ACTIVE" } },
    });
    return removed.count;
  });
}
