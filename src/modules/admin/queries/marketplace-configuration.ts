import "server-only";

import { db } from "@/lib/database";

export async function getMarketplaceConfiguration() {
  return db.marketplaceConfiguration.findUnique({ where: { key: "default" } });
}
