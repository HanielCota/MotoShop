import "server-only";

import { db } from "@/lib/database";

export async function listShipmentPurchasesNeedingReconciliation() {
  return db.shipment.findMany({
    where: { provider: "MELHOR_ENVIO", purchaseState: { not: null }, externalShipmentId: null },
    select: {
      id: true,
      purchaseState: true,
      purchaseError: true,
      createdAt: true,
      updatedAt: true,
      service: true,
      sellerOrder: {
        select: {
          id: true,
          storeNameSnapshot: true,
          order: { select: { orderNumber: true, customerName: true } },
        },
      },
    },
    orderBy: { updatedAt: "asc" },
    take: 100,
  });
}
