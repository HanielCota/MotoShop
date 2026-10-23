import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check for the internal pages of the Central do Lojista: a visitor with no session cookie
 * goes to the login with the page they asked for as `next`, so signing in brings them back there. It
 * only looks at the cookie; the (private) layout and each page still check the session, the store
 * membership and the permission on the server.
 */
export function proxy(request: NextRequest): NextResponse {
  if (getSessionCookie(request) != null) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(loginUrl);
}

// /seller itself is the public "Cadastre sua loja" page, so only the pages below it pass here.
export const config = { matcher: "/seller/:path+" };
