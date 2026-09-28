import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { env } from "@/config/env";
import { db } from "@/lib/database";
import { getCurrentSession } from "@/modules/auth/application/authorization";

export const CART_COOKIE_NAME = "motoshop_cart_token";

export type CartIdentity = { userId: string } | { guestAccessTokenHash: string };

export async function getCartIdentity(createGuest = false): Promise<CartIdentity | null> {
  const session = await getCurrentSession();
  if (session) return { userId: session.user.id };

  const cookieStore = await cookies();
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
    const lockKey =
      "userId" in identity ? `cart:user:${identity.userId}` : `cart:guest:${identity.guestAccessTokenHash}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
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
