import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * Returns a checkout cart to ACTIVE after its order was cancelled for a payment failure,
 * so the customer can fix the card and try again without rebuilding the cart.
 *
 * Only one ACTIVE cart per owner is allowed (partial unique indexes). If the customer
 * already started another ACTIVE cart meanwhile, that newer cart wins and the converted
 * one is left as is (its items remain visible in the cancelled order).
 */
export async function reactivateCartAfterPaymentFailure(
  tx: Pick<Prisma.TransactionClient, "cart">,
  cartId: string,
): Promise<boolean> {
  const cart = await tx.cart.findUnique({
    where: { id: cartId },
    select: { status: true, userId: true, guestAccessTokenHash: true },
  });
  if (!cart || cart.status !== "CONVERTED") return false;
  const owner = cart.userId
    ? { userId: cart.userId }
    : cart.guestAccessTokenHash
      ? { guestAccessTokenHash: cart.guestAccessTokenHash }
      : null;
  if (!owner) return false;
  const otherActiveCart = await tx.cart.findFirst({ where: { ...owner, status: "ACTIVE" }, select: { id: true } });
  if (otherActiveCart) return false;
  const reactivated = await tx.cart.updateMany({
    where: { id: cartId, status: "CONVERTED" },
    data: { status: "ACTIVE" },
  });
  return reactivated.count === 1;
}
