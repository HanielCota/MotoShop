import "server-only";

import { APIError, isAPIError } from "better-auth/api";

import { clearRateLimit, consumeRateLimit, peekRateLimit } from "@/shared/rate-limit/consume-rate-limit";

export const SIGN_IN_ACCOUNT_WINDOW_SECONDS = 15 * 60;
export const SIGN_IN_ACCOUNT_MAX_FAILURES = 10;

const SIGN_IN_PATH = "/sign-in/email";

function signInEmail(path: string | undefined, body: unknown): string | null {
  if (path !== SIGN_IN_PATH) return null;
  if (!body || typeof body !== "object" || !("email" in body) || typeof body.email !== "string") return null;

  const email = body.email.trim().toLowerCase();
  return email || null;
}

function accountKey(email: string): string {
  return `auth:sign-in-account:${email}`;
}

/**
 * M-01: per-account throttle for e-mail sign-in, on top of Better Auth's per-IP rule. Only
 * FAILED attempts count, and a successful sign-in clears them, so someone who knows an e-mail
 * cannot lock its owner out with a few requests. Runs whether or not the account exists (no
 * enumeration); the key is hashed before it is stored.
 */
export async function assertSignInAccountNotLocked(path: string | undefined, body: unknown): Promise<void> {
  const email = signInEmail(path, body);
  if (!email) return;

  const state = await peekRateLimit({ key: accountKey(email), max: SIGN_IN_ACCOUNT_MAX_FAILURES });
  if (!state.blocked) return;

  throw new APIError(
    "TOO_MANY_REQUESTS",
    { code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." },
    state.retryAfter ? { "X-Retry-After": String(state.retryAfter) } : undefined,
  );
}

/** Counts a rejected sign-in (wrong e-mail or password) and forgets the failures after a success. */
export async function recordSignInAccountOutcome(
  path: string | undefined,
  body: unknown,
  returned: unknown,
): Promise<void> {
  const email = signInEmail(path, body);
  if (!email) return;

  if (!isAPIError(returned)) {
    await clearRateLimit(accountKey(email));
    return;
  }
  if (returned.statusCode !== 401) return;

  await consumeRateLimit({
    key: accountKey(email),
    windowSeconds: SIGN_IN_ACCOUNT_WINDOW_SECONDS,
    max: SIGN_IN_ACCOUNT_MAX_FAILURES,
  });
}
