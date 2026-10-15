import "server-only";

import pino, { type redactOptions } from "pino";

import { env } from "@/config/env";

// Secrets: censored at the top level and up to two levels deep (L-14), e.g. `{ input: { auth: { token } } }`.
const SECRET_KEYS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "access_token",
  "refresh_token",
  "idToken",
  "authorization",
  "cookie",
  "set-cookie",
  "secret",
  "clientSecret",
  "client_secret",
  "apiKey",
  "api_key",
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

/** Bracket notation, so keys with dashes ("set-cookie") are valid redact paths. */
function atDepths(keys: readonly string[], depth: number): string[] {
  const prefixes = ["", "*.", "*.*."].slice(0, depth + 1);
  return prefixes.flatMap((prefix) => keys.map((key) => `${prefix}["${key}"]`));
}

export const loggerRedaction: redactOptions = {
  paths: [...atDepths(SECRET_KEYS, 2), ...atDepths(PERSONAL_DATA_KEYS, 1)],
  censor: "[REDACTED]",
};

// Errors logged under `error` came out as {} because pino only serializes `err` (L-14).
export const loggerSerializers = { err: pino.stdSerializers.err, error: pino.stdSerializers.err };

export const logger = pino({
  level: env.LOG_LEVEL ?? "info",
  base: { service: "motoshop", environment: env.NODE_ENV },
  redact: loggerRedaction,
  serializers: loggerSerializers,
});
