import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PAGE_LOAD_METHODS = new Set(["GET", "HEAD"]);

/**
 * Optimistic check for the internal pages of the Central do Lojista: a visitor with no session cookie
 * goes to the login with the page they asked for as `next`, so signing in brings them back there. It
 * only looks at the cookie; the (private) layout and each page still check the session, the store
 * membership and the permission on the server.
 *
 * Only page loads (GET/HEAD) are redirected. Server Functions are POSTs to the page's own path: a 307
 * would replay them against /login and break the action, while the action's own session check already
 * answers them with a redirect the Next router understands.
 */
export function proxy(request: NextRequest): NextResponse {
  if (!PAGE_LOAD_METHODS.has(request.method)) return NextResponse.next();
  if (getSessionCookie(request) != null) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(loginUrl);
}

// /seller itself is the public "Cadastre sua loja" page, so only the pages below it pass here.
export const config = { matcher: "/seller/:path+" };
