import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SENTRY_DSN: z.preprocess((value) => (value === "" ? undefined : value), z.url().optional()),
});

const parsedPublicEnv = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});

if (!parsedPublicEnv.success) {
  throw new Error(`Invalid public environment: ${z.prettifyError(parsedPublicEnv.error)}`);
}

export const publicEnv = Object.freeze(parsedPublicEnv.data);
