import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";

import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { env } from "@/config/env";
import { db } from "@/lib/database";
import { sendAuthEmail } from "@/modules/auth/application/send-auth-email";
import { parseAuthUserName } from "@/modules/auth/domain/auth-user-name";
import { enforceSignInAccountRateLimit } from "@/modules/auth/infrastructure/sign-in-account-rate-limit";
import { consumeRateLimit } from "@/shared/rate-limit/consume-rate-limit";

export const authEmailConfigured = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
export const authEmailVerificationRequired = authEmailConfigured && env.AUTH_REQUIRE_EMAIL_VERIFICATION === true;

function requireValidUserName(name: unknown): string {
  const result = parseAuthUserName(name);
  if (!result.ok) throw new APIError("BAD_REQUEST", { message: result.message, code: "INVALID_NAME" });
  return result.name;
}

export const auth = betterAuth({
  appName: "O Moto Shop",
  baseURL: getApplicationBaseUrl(),
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: authEmailVerificationRequired,
    revokeSessionsOnPasswordReset: true,
    ...(authEmailConfigured
      ? {
          sendResetPassword: async ({ user, url, token }: { user: { email: string }; url: string; token: string }) =>
            sendAuthEmail({ kind: "reset", to: user.email, url, token }),
        }
      : {}),
  },
  ...(authEmailConfigured
    ? {
        emailVerification: {
          sendOnSignUp: true,
          sendOnSignIn: true,
          sendVerificationEmail: async ({
            user,
            url,
            token,
          }: {
            user: { email: string };
            url: string;
            token: string;
          }) => sendAuthEmail({ kind: "verify", to: user.email, url, token }),
        },
      }
    : {}),
  rateLimit: {
    enabled: true,
    customStorage: {
      consume: (key, rule) => consumeRateLimit({ key: `auth:${key}`, windowSeconds: rule.window, max: rule.max }),
    },
    customRules: {
      "/get-session": false,
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
      "/change-password": { window: 60, max: 5 },
      "/update-user": { window: 60, max: 10 },
    },
  },
  hooks: {
    // Per-account limit on top of the per-IP rule above (see sign-in-account-rate-limit.ts).
    before: createAuthMiddleware(async (context) => enforceSignInAccountRateLimit(context.path, context.body)),
  },
  databaseHooks: {
    user: {
      create: { before: async (user) => ({ data: { ...user, name: requireValidUserName(user.name) } }) },
      update: {
        before: async (data) =>
          data.name === undefined ? { data } : { data: { ...data, name: requireValidUserName(data.name) } },
      },
    },
  },
  database: prismaAdapter(db, { provider: "postgresql" }),
  advanced: { database: { joins: true } },
});
