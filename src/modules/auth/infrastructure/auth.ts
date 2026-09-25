import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth/minimal";

import { env } from "@/config/env";
import { db } from "@/lib/database";

export const auth = betterAuth({
  appName: "Moto Shop",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  database: prismaAdapter(db, { provider: "postgresql" }),
  advanced: { database: { joins: true } },
});
