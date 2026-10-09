import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { purchasableVariantWhere } from "@/modules/products/application/purchasable-variant";

export const MAX_CART_ITEM_QUANTITY = 99;

/** Advisory-lock key shared by every transaction that creates or merges a cart for an owner. */
export function cartLockKey(owner: { userId: string } | { guestAccessTokenHash: string }): string {
  return "userId" in owner ? `cart:user:${owner.userId}` : `cart:guest:${owner.guestAccessTokenHash}`;
}

export type GuestCartMergeResult = { merged: boolean; mergedVariants: number; skippedVariants: number };

type GuestCartItem = { variantId: string; quantity: number };

function nothingMerged(): GuestCartMergeResult {
  return { merged: false, mergedVariants: 0, skippedVariants: 0 };
}

/** Cheap pre-check so signed-in requests only open a transaction when there is something to merge. */
export async function hasActiveGuestCart(guestAccessTokenHash: string): Promise<boolean> {
  const cart = await db.cart.findFirst({
    where: { guestAccessTokenHash, userId: null, status: "ACTIVE" },
    select: { id: true },
  });
  return Boolean(cart);
}

/**
 * Moves the visitor's active guest cart into the signed-in user's active cart.
 *
 * - Only carts without `userId` are read as the source, and the destination is
 *   always the authenticated user's cart, so items never cross between users.
 * - Quantities are summed per variant, capped by the per-item limit and the
 *   current available stock; existing user quantities are never reduced.
 * - Variants that are no longer purchasable (demo, inactive, unapproved, out of
 *   stock) are skipped.
 * - The guest cart is then marked ABANDONED, which makes the merge idempotent:
 *   a repeated call finds no active guest cart and does nothing.
 */
export async function mergeGuestCartIntoUserCart(input: {
  userId: string;
  guestAccessTokenHash: string;
}): Promise<GuestCartMergeResult> {
  const { userId, guestAccessTokenHash } = input;

  return db.$transaction(async (tx) => {
    await lockCartOwners(tx, { userId, guestAccessTokenHash });

    const guestCandidate = await tx.cart.findFirst({
      where: { guestAccessTokenHash, userId: null, status: "ACTIVE" },
      select: { id: true },
    });
    if (!guestCandidate) return nothingMerged();

    const userCart = await findOrCreateUserCart(tx, userId);
    await lockCartRows(tx, [guestCandidate.id, userCart.id]);

    // Re-check the guest cart after the row lock: a concurrent merge may have abandoned it.
    const guest = await tx.cart.findFirst({
      where: { id: guestCandidate.id, guestAccessTokenHash, userId: null, status: "ACTIVE" },
      select: { id: true, items: { select: { variantId: true, quantity: true } } },
    });
    if (!guest) return nothingMerged();

    const { mergedVariants, skippedVariants } = await mergeGuestItems(tx, userCart.id, guest.items);

    await tx.cart.updateMany({
      where: { id: guest.id, userId: null, status: "ACTIVE" },
      data: { status: "ABANDONED" },
    });
    return { merged: true, mergedVariants, skippedVariants };
  });
}

/** Same advisory keys as findOrCreateActiveCart, always guest first then user. */
async function lockCartOwners(tx: Prisma.TransactionClient, owners: { userId: string; guestAccessTokenHash: string }) {
  const guestLock = cartLockKey({ guestAccessTokenHash: owners.guestAccessTokenHash });
  const userLock = cartLockKey({ userId: owners.userId });
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${guestLock}, 0))`;
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${userLock}, 0))`;
}

async function findOrCreateUserCart(tx: Prisma.TransactionClient, userId: string) {
  return (
    (await tx.cart.findFirst({ where: { userId, status: "ACTIVE" }, select: { id: true } })) ??
    (await tx.cart.create({ data: { userId, status: "ACTIVE" }, select: { id: true } }))
  );
}

/** Row locks in a stable order, like other cart mutations. */
async function lockCartRows(tx: Prisma.TransactionClient, cartIds: readonly string[]) {
  for (const id of [...cartIds].sort()) {
    await tx.$queryRaw`SELECT id FROM "carts" WHERE id = ${id} FOR UPDATE`;
  }
}

async function mergeGuestItems(tx: Prisma.TransactionClient, userCartId: string, guestItems: readonly GuestCartItem[]) {
  const variantIds = [...new Set(guestItems.map((item) => item.variantId))];
  const { availableByVariant, currentByVariant } = await loadMergeQuantities(tx, userCartId, variantIds);

  let mergedVariants = 0;
  for (const item of guestItems) {
    const available = availableByVariant.get(item.variantId);
    const current = currentByVariant.get(item.variantId) ?? 0;
    const target = Math.min(current + item.quantity, MAX_CART_ITEM_QUANTITY, available ?? 0);
    if (available === undefined || target <= current) continue;
    await tx.cartItem.upsert({
      where: { cartId_variantId: { cartId: userCartId, variantId: item.variantId } },
      create: { cartId: userCartId, variantId: item.variantId, quantity: target },
      update: { quantity: target },
    });
    currentByVariant.set(item.variantId, target);
    mergedVariants += 1;
  }
  return { mergedVariants, skippedVariants: guestItems.length - mergedVariants };
}

/** Available stock of purchasable variants and the quantities already in the user's cart. */
async function loadMergeQuantities(tx: Prisma.TransactionClient, userCartId: string, variantIds: readonly string[]) {
  const [variants, existingItems] = variantIds.length
    ? await Promise.all([
        tx.productVariant.findMany({
          where: { OR: variantIds.map((id) => purchasableVariantWhere(id, { requireStock: true })) },
          select: { id: true, inventory: { select: { availableQuantity: true } } },
        }),
        tx.cartItem.findMany({
          where: { cartId: userCartId, variantId: { in: [...variantIds] } },
          select: { variantId: true, quantity: true },
        }),
      ])
    : [[], []];
  return {
    availableByVariant: new Map(variants.map((variant) => [variant.id, variant.inventory?.availableQuantity ?? 0])),
    currentByVariant: new Map(existingItems.map((item) => [item.variantId, item.quantity])),
  };
}
