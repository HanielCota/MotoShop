import { NextResponse } from "next/server";

import { env } from "@/config/env";
import { createMelhorEnvioAuthorizationUrl } from "@/modules/shipping/infrastructure/melhor-envio-oauth";
import { requireSellerAccess } from "@/modules/auth/application/authorization";

export async function GET() {
  const { session, seller } = await requireSellerAccess("SELLER_MANAGE");
  const { url, state } = createMelhorEnvioAuthorizationUrl({ userId: session.user.id, sellerId: seller.id });
  const response = NextResponse.redirect(url);
  response.cookies.set("melhor-envio-oauth-state", state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/shipping/melhor-envio/callback",
    maxAge: 10 * 60,
  });
  return response;
}
