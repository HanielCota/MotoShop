import "server-only";

import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyStringToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyStringToUndefined, z.url().optional());
const optionalBoolean = z.preprocess((value) => {
  if (value === "") return undefined;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}, z.boolean().optional());

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    ADMIN_EMAILS: optionalString,
    MERCADO_PAGO_ACCESS_TOKEN: optionalString,
    MERCADO_PAGO_API_URL: optionalUrl,
    MERCADO_PAGO_MULTI_SELLER_ENABLED: optionalBoolean,
    MERCADO_PAGO_WEBHOOK_SECRET: optionalString,
    MELHOR_ENVIO_TOKEN: optionalString,
    MELHOR_ENVIO_API_URL: optionalUrl,
    MELHOR_ENVIO_ORIGIN_POSTAL_CODE: optionalString,
    MELHOR_ENVIO_USER_AGENT: optionalString,
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    SENTRY_DSN: optionalUrl,
    UPSTASH_REDIS_REST_URL: optionalUrl,
    UPSTASH_REDIS_REST_TOKEN: optionalString,
    R2_ACCOUNT_ID: optionalString,
    R2_ACCESS_KEY_ID: optionalString,
    R2_SECRET_ACCESS_KEY: optionalString,
    R2_BUCKET_NAME: optionalString,
    R2_PUBLIC_URL: optionalUrl,
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: optionalString,
  })
  .superRefine((value, context) => {
    const groups = [
      { label: "Upstash Redis", keys: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const },
      {
        label: "Cloudflare R2",
        keys: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const,
      },
      { label: "Resend", keys: ["RESEND_API_KEY", "EMAIL_FROM"] as const },
    ];

    for (const group of groups) {
      const configuredCount = group.keys.filter((key) => value[key] !== undefined).length;
      if (configuredCount > 0 && configuredCount < group.keys.length) {
        context.addIssue({
          code: "custom",
          message: `${group.label} variables must be configured together`,
          path: [group.keys[0]],
        });
      }
    }
  });

const parsedEnv = serverEnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid server environment: ${z.prettifyError(parsedEnv.error)}`);
}

export const env = Object.freeze(parsedEnv.data);
