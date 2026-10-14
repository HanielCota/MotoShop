import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { resolveCustomerOrderIdentity } from "@/modules/orders/application/resolve-customer-order-access";
import {
  GUEST_ORDER_COOKIE,
  guestOrderCookieOptions,
  guestOrderPath,
} from "@/modules/orders/infrastructure/guest-order-cookie";

const accessInputSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  token: z.string().trim().min(20).max(200),
});

/**
 * Entry point for links that carry the guest token (e.g. an order e-mail): the token is swapped for
 * an HttpOnly cookie scoped to the order and the visitor lands on the clean order URL.
 * An invalid or expired token sets nothing; the order page then answers as for any stranger.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const response = NextResponse.redirect(new URL(guestOrderPath(orderNumber), getApplicationBaseUrl()), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");

  const parsed = accessInputSchema.safeParse({ orderNumber, token: request.nextUrl.searchParams.get("token") ?? "" });
  if (!parsed.success) return response;

  const identity = await resolveCustomerOrderIdentity({
    orderNumber: parsed.data.orderNumber,
    accessToken: parsed.data.token,
  });
  if (identity && "guestAccessTokenHash" in identity) {
    response.cookies.set(GUEST_ORDER_COOKIE, parsed.data.token, guestOrderCookieOptions(parsed.data.orderNumber));
  }

  return response;
}
