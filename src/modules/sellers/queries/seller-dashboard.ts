import "server-only";

import { db } from "@/lib/database";

export async function getSellerFinancialSummary(sellerId: string) {
  const aggregate = await db.sellerOrder.aggregate({
    where: { sellerId, status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } },
    _count: { _all: true },
    _sum: {
      itemsSubtotalInCents: true,
      discountAmountInCents: true,
      marketplaceCommissionInCents: true,
      sellerNetAmountInCents: true,
    },
  });

  const itemsSubtotalInCents = aggregate._sum.itemsSubtotalInCents ?? 0;
  const discountAmountInCents = aggregate._sum.discountAmountInCents ?? 0;
  return {
    orderCount: aggregate._count._all,
    grossSalesInCents: itemsSubtotalInCents - discountAmountInCents,
    commissionInCents: aggregate._sum.marketplaceCommissionInCents ?? 0,
    sellerNetAmountInCents: aggregate._sum.sellerNetAmountInCents ?? 0,
  };
}

export async function listSellerLowStockVariants(sellerId: string, threshold = 5) {
  return db.inventory.findMany({
    where: {
      sellerId,
      availableQuantity: { lte: threshold },
      variant: { sellerId, active: true, product: { sellerId } },
    },
    select: {
      id: true,
      availableQuantity: true,
      variant: {
        select: {
          id: true,
          title: true,
          sku: true,
          product: { select: { id: true, name: true, slug: true, status: true } },
        },
      },
    },
    orderBy: [{ availableQuantity: "asc" }, { updatedAt: "desc" }],
    take: 12,
  });
}
