/**
 * M-03: `/get-session` returns the session token in its JSON. The cookie is HttpOnly, but a
 * script injected by any future XSS could read the token through this endpoint and replay the
 * session elsewhere. The app never reads `session.token` on the client, so it is removed from
 * the response; the cookie keeps working as before.
 */
export function withoutSessionToken(path: string | undefined, returned: unknown): unknown {
  if (path !== "/get-session") return undefined;
  if (!returned || typeof returned !== "object" || !("session" in returned)) return undefined;

  const { session } = returned;
  if (!session || typeof session !== "object" || !("token" in session)) return undefined;

  const publicSession = Object.fromEntries(Object.entries(session).filter(([key]) => key !== "token"));
  return { ...returned, session: publicSession };
}
