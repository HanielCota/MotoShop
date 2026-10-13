import "server-only";

import pino, { type redactOptions } from "pino";

import { env } from "@/config/env";

const SECRET_KEYS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "headers.authorization",
  "headers.cookie",
  "card",
  "cvv",
];

// Personal data: censored at the top level and one level deep (e.g. `{ customer: { email } }`).
const PERSONAL_DATA_KEYS = [
  "email",
  "customerEmail",
  "recipientEmail",
  "originEmail",
  "cpf",
  "taxId",
  "customerTaxId",
  "document",
  "originDocument",
  "phone",
  "customerPhone",
  "originPhone",
];

export const loggerRedaction: redactOptions = {
  paths: [...SECRET_KEYS, ...PERSONAL_DATA_KEYS, ...PERSONAL_DATA_KEYS.map((key) => `*.${key}`)],
  censor: "[REDACTED]",
};

export const logger = pino({
  level: env.LOG_LEVEL ?? "info",
  base: { service: "motoshop", environment: env.NODE_ENV },
  redact: loggerRedaction,
});
