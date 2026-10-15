/**
 * Hides the review demo stores from the public storefront (and from checkout) by moving their
 * sellers back to PENDING. Needed while production runs code without the `isDemo` purchase block.
 * Only touches sellers whose store slug starts with "review-". Reverse with the review seed.
 */
import { config } from "dotenv";
import { requireScriptDatabaseUrl } from "./database-guard";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local", quiet: true });

const databaseUrl = requireScriptDatabaseUrl(process.env, "db:hide:review");

const database = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });

try {
  const result = await database.seller.updateMany({
    where: { store: { slug: { startsWith: "review-" } }, status: { in: ["APPROVED", "ACTIVE"] } },
    data: { status: "PENDING" },
  });
  console.log(`Review sellers moved to PENDING: ${result.count}`);
} finally {
  await database.$disconnect();
}
