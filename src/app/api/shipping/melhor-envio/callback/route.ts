import { NextRequest, NextResponse } from "next/server";

import { env } from "@/config/env";
import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { hasSellerPermission } from "@/modules/auth/domain/seller-permissions";
import {
  exchangeMelhorEnvioAuthorizationCode,
  persistMelhorEnvioConnection,
  verifyMelhorEnvioState,
} from "@/modules/shipping/infrastructure/melhor-envio-oauth";
import { ApplicationError } from "@/shared/errors/application-error";

const STATE_COOKIE = "melhor-envio-oauth-state";

export async function GET(request: NextRequest) {
  const callbackUrl = new URL("/seller/shipping/integrations", getApplicationBaseUrl());
  const stateValue = request.nextUrl.searchParams.get("state");
  const cookieValue = request.cookies.get(STATE_COOKIE)?.value;
  const state =
    stateValue && cookieValue && safeEqual(stateValue, cookieValue) ? verifyMelhorEnvioState(stateValue) : null;
  const redirectWithClearedState = (url: URL) => {
    const response = NextResponse.redirect(url);
    response.cookies.set(STATE_COOKIE, "", {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/shipping/melhor-envio/callback",
      maxAge: 0,
    });
    return response;
  };

  if (!state || request.nextUrl.searchParams.has("error")) {
    callbackUrl.searchParams.set("shipping", "authorization_failed");
    return redirectWithClearedState(callbackUrl);
  }

  const session = await getCurrentSession();
  if (!session || session.user.id !== state.userId) {
    callbackUrl.searchParams.set("shipping", "session_expired");
    return redirectWithClearedState(callbackUrl);
  }

  const membership = await db.sellerMember.findFirst({
    where: {
      sellerId: state.sellerId,
      userId: session.user.id,
      seller: { status: { in: ["APPROVED", "ACTIVE"] } },
    },
    select: { role: true },
  });
  if (!membership || !hasSellerPermission(membership.role, "SELLER_MANAGE")) {
    callbackUrl.searchParams.set("shipping", "permission_denied");
    return redirectWithClearedState(callbackUrl);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code || code.length > 2048) {
    callbackUrl.searchParams.set("shipping", "authorization_failed");
    return redirectWithClearedState(callbackUrl);
  }

  try {
    const tokenData = await exchangeMelhorEnvioAuthorizationCode(code);
    await persistMelhorEnvioConnection(state.sellerId, tokenData);
    callbackUrl.searchParams.set("shipping", "connected");
  } catch (error) {
    logger.error({
      event: "shipping.melhor_envio_oauth.callback_failed",
      sellerId: state.sellerId,
      errorCode: error instanceof ApplicationError ? error.code : "UNKNOWN",
    });
    callbackUrl.searchParams.set("shipping", "authorization_failed");
  }
  return redirectWithClearedState(callbackUrl);
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
