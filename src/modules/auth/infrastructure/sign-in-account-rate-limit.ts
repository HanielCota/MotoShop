import "server-only";

import { APIError } from "better-auth/api";

import { consumeRateLimit } from "@/shared/rate-limit/consume-rate-limit";

export const SIGN_IN_ACCOUNT_WINDOW_SECONDS = 15 * 60;
export const SIGN_IN_ACCOUNT_MAX_ATTEMPTS = 10;

/**
 * Per-account throttle for e-mail sign-in, applied on top of Better Auth's
 * per-IP rule so distributed guessing against one account is also limited.
 * It runs whether or not the account exists (no enumeration), and the key is
 * hashed by `consumeRateLimit`, so the e-mail is never persisted in clear.
 */
export async function enforceSignInAccountRateLimit(path: string | undefined, body: unknown): Promise<void> {
  if (path !== "/sign-in/email") return;
  const email =
    body && typeof body === "object" && "email" in body && typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
  if (!email) return;

  const result = await consumeRateLimit({
    key: `auth:sign-in-account:${email}`,
    windowSeconds: SIGN_IN_ACCOUNT_WINDOW_SECONDS,
    max: SIGN_IN_ACCOUNT_MAX_ATTEMPTS,
  });
  if (!result.allowed) {
    throw new APIError(
      "TOO_MANY_REQUESTS",
      { code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." },
      result.retryAfter ? { "X-Retry-After": String(result.retryAfter) } : undefined,
    );
  }
}
