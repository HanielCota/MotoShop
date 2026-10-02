import "server-only";

import { env } from "@/config/env";

import { resolveApplicationBaseUrl } from "./application-url";

export function getApplicationBaseUrl(): string {
  return resolveApplicationBaseUrl({
    configuredUrl: env.BETTER_AUTH_URL,
    deploymentEnvironment: process.env.VERCEL_ENV,
    deploymentUrl: process.env.VERCEL_URL,
  });
}
