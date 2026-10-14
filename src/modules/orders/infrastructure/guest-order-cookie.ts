import "server-only";

import { cookies } from "next/headers";

import { env } from "@/config/env";

/**
 * The guest order token lives in an HttpOnly cookie scoped to that order's page, never in the URL,
 * so it stays out of browser history, access logs and error reports. The server still decides
 * whether the token is valid and unexpired on every request.
 */
export const GUEST_ORDER_COOKIE = "ms_guest_order";
const GUEST_ORDER_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function guestOrderPath(orderNumber: string) {
  return `/orders/${encodeURIComponent(orderNumber)}`;
}

export function guestOrderCookieOptions(orderNumber: string) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    // The order page and its Server Actions (which post to the same URL) receive it; nothing else does.
    path: guestOrderPath(orderNumber),
    maxAge: GUEST_ORDER_COOKIE_MAX_AGE_SECONDS,
  };
}

/** For Server Actions; Route Handlers set it on their response. */
export async function setGuestOrderCookie(orderNumber: string, token: string) {
  const cookieStore = await cookies();
  cookieStore.set(GUEST_ORDER_COOKIE, token, guestOrderCookieOptions(orderNumber));
}

/** Only the cookie of the order whose page is being requested reaches the server. */
export async function readGuestOrderCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_ORDER_COOKIE)?.value;
}
