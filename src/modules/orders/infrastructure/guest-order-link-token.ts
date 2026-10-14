import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/config/env";

/**
 * Second guest credential, used only in the order e-mail link. It is derived from the order id with
 * the server secret, so the e-mail workflow can rebuild it without the checkout token ever leaving
 * the request that created it. It only works while the order still has a guest token (the claim
 * revokes both) and within the same validity window.
 */
export function createGuestOrderLinkToken(orderId: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(`guest-order-link:${orderId}`).digest("hex");
}

export function isGuestOrderLinkToken(orderId: string, token: string): boolean {
  const expected = Buffer.from(createGuestOrderLinkToken(orderId));
  const received = Buffer.from(token);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
