import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth/minimal";

import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { env } from "@/config/env";
import { db } from "@/lib/database";
import { sendAuthEmail } from "@/modules/auth/application/send-auth-email";
import { consumeRateLimit } from "@/shared/rate-limit/consume-rate-limit";

export const authEmailConfigured = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
export const authEmailVerificationRequired = authEmailConfigured && env.AUTH_REQUIRE_EMAIL_VERIFICATION === true;

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
    },
  },
  database: prismaAdapter(db, { provider: "postgresql" }),
  advanced: { database: { joins: true } },
});
