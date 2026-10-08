import "server-only";

import { db } from "@/lib/database";

export async function listSellerShippingMethods(sellerId: string) {
  return db.sellerShippingMethod.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
  });
}

export async function hasSellerShippingIntegration(sellerId: string) {
  const integration = await db.sellerShippingIntegration.findUnique({ where: { sellerId }, select: { id: true } });
  return Boolean(integration);
}
