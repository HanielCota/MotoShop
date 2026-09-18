import "server-only";

import { PrismaNeon } from "@prisma/adapter-neon";

import { env } from "@/config/env";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDatabase = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalForDatabase.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForDatabase.prisma = db;
}
