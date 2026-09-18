import "server-only";

import { Redis } from "@upstash/redis";

import { env } from "@/config/env";
import { ApplicationError } from "@/shared/errors/application-error";

let redisClient: Redis | undefined;

export function getRedisClient(): Redis {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new ApplicationError({ code: "CONFIGURATION_ERROR", message: "Upstash Redis is not configured." });
  }

  redisClient ??= new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  return redisClient;
}
