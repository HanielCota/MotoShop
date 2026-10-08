import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { env } from "@/config/env";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { getCurrentSession } from "@/modules/auth/application/authorization";

import { cartLockKey, hasActiveGuestCart, mergeGuestCartIntoUserCart } from "../application/merge-guest-cart";

export const CART_COOKIE_NAME = "motoshop_cart_token";

export type CartIdentity = { userId: string } | { guestAccessTokenHash: string };

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * A visitor who signs in (or signs up) while still carrying the guest cart
 * cookie gets that cart merged into their account cart on the first cart read.
 * Done lazily here because the cookie is only reliably available in the request
 * that renders/mutates the cart. The merge is idempotent (the guest cart is
 * marked ABANDONED), so failing to delete the cookie — e.g. while rendering a
 * Server Component, where cookies are read-only — is harmless.
 */
async function mergeGuestCartOnSignIn(userId: string, cookieStore: CookieStore): Promise<void> {
  const guestToken = cookieStore.get(CART_COOKIE_NAME)?.value;
  if (!guestToken) return;

  const guestAccessTokenHash = hashGuestToken(guestToken);
  try {
    if (await hasActiveGuestCart(guestAccessTokenHash)) {
      const result = await mergeGuestCartIntoUserCart({ userId, guestAccessTokenHash });
      if (result.merged) logger.info({ event: "cart.guest_merged", userId, ...result });
    }
  } catch (error) {
    // The account cart must stay usable even if the merge fails; it is retried on the next read.
    logger.warn({
      event: "cart.guest_merge_failed",
      userId,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return;
  }

  try {
    cookieStore.delete(CART_COOKIE_NAME);
  } catch {
    // Read-only cookies (Server Component render): the next Server Action clears it.
  }
}

export async function getCartIdentity(createGuest = false): Promise<CartIdentity | null> {
  const session = await getCurrentSession();
  const cookieStore = await cookies();
  if (session) {
    await mergeGuestCartOnSignIn(session.user.id, cookieStore);
    return { userId: session.user.id };
  }

  const existingToken = cookieStore.get(CART_COOKIE_NAME)?.value;
  if (existingToken) return { guestAccessTokenHash: hashGuestToken(existingToken) };
  if (!createGuest) return null;

  const token = randomUUID();
  cookieStore.set(CART_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return { guestAccessTokenHash: hashGuestToken(token) };
}

export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function cartOwnerWhere(identity: CartIdentity) {
  return "userId" in identity ? { userId: identity.userId } : { guestAccessTokenHash: identity.guestAccessTokenHash };
}

export async function findOrCreateActiveCart(identity: CartIdentity) {
  const owner = cartOwnerWhere(identity);
  return db.$transaction(async (tx) => {
    // Select a concrete scalar instead of PostgreSQL's `void` lock result;
    // Prisma cannot deserialize `void` through `$queryRaw`.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${cartLockKey(identity)}, 0))`;
    const existing = await tx.cart.findFirst({ where: { ...owner, status: "ACTIVE" } });
    if (existing) return existing;

    return tx.cart.create({
      data: {
        status: "ACTIVE",
        ...owner,
        ...("guestAccessTokenHash" in identity ? { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } : {}),
      },
    });
  });
}
