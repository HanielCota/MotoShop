import "server-only";

import pino from "pino";

import { env } from "@/config/env";

export const logger = pino({
  level: env.LOG_LEVEL ?? "info",
  base: { service: "motoshop", environment: env.NODE_ENV },
  redact: {
    paths: [
      "password",
      "token",
      "accessToken",
      "refreshToken",
      "authorization",
      "headers.authorization",
      "headers.cookie",
      "card",
      "cvv",
    ],
    censor: "[REDACTED]",
  },
});
