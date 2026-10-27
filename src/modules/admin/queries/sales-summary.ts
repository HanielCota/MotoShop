import "server-only";

import type { OrderStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";

import type { SalesDateRange } from "./sales-period";
import {
  averageTicketInCents,
  confirmedSellerOrderStatuses,
  rankStoresByGrossSales,
  SALES_RANKING_SIZE,
  sumSalesTotals,
  type StoreSalesTotals,
} from "./sales-figures";

export type AdminSalesSummary = Awaited<ReturnType<typeof getAdminSalesSummary>>;

function confirmedSellerOrdersIn(range: SalesDateRange) {
  return {
    status: { in: [...confirmedSellerOrderStatuses] },
    createdAt: { gte: range.start, lt: range.end },
  };
}

async function listStoreSalesTotals(range: SalesDateRange): Promise<StoreSalesTotals[]> {
  const groups = await db.sellerOrder.groupBy({
    by: ["sellerId"],
    where: confirmedSellerOrdersIn(range),
    _count: { _all: true },
    _sum: {
      itemsSubtotalInCents: true,
      discountAmountInCents: true,
      customerShippingAmountInCents: true,
      sellerNetAmountInCents: true,
      marketplaceCommissionInCents: true,
    },
  });

  return groups.map((group) => ({
    sellerId: group.sellerId,
    orderCount: group._count._all,
    itemsSubtotalInCents: group._sum.itemsSubtotalInCents ?? 0,
    discountAmountInCents: group._sum.discountAmountInCents ?? 0,
    customerShippingAmountInCents: group._sum.customerShippingAmountInCents ?? 0,
    sellerNetAmountInCents: group._sum.sellerNetAmountInCents ?? 0,
    marketplaceCommissionInCents: group._sum.marketplaceCommissionInCents ?? 0,
  }));
}

async function listTopStores(stores: readonly StoreSalesTotals[]) {
  const ranked = rankStoresByGrossSales(stores);
  if (ranked.length === 0) return [];

  const sellers = await db.seller.findMany({
    where: { id: { in: ranked.map((store) => store.sellerId) } },
    select: { id: true, store: { select: { name: true } } },
  });
  const storeNames = new Map(sellers.map((seller) => [seller.id, seller.store?.name ?? "Loja sem nome"]));

  return ranked.map((store) => ({ ...store, storeName: storeNames.get(store.sellerId) ?? "Loja sem nome" }));
}

/** The product name is read from the latest sale of each SKU, so a renamed product shows its current name. */
async function listTopProducts(range: SalesDateRange) {
  const sellerOrder = confirmedSellerOrdersIn(range);
  const groups = await db.orderItem.groupBy({
    by: ["sellerId", "skuSnapshot"],
    where: { sellerOrder },
    _sum: { quantity: true, totalAmountInCents: true },
    orderBy: [{ _sum: { quantity: "desc" } }, { _sum: { totalAmountInCents: "desc" } }],
    take: SALES_RANKING_SIZE,
  });

  return Promise.all(
    groups.map(async (group) => {
      const latestSale = await db.orderItem.findFirst({
        where: { sellerId: group.sellerId, skuSnapshot: group.skuSnapshot, sellerOrder },
        orderBy: { createdAt: "desc" },
        select: { productNameSnapshot: true },
      });

      return {
        sellerId: group.sellerId,
        sku: group.skuSnapshot,
        productName: latestSale?.productNameSnapshot ?? group.skuSnapshot,
        quantity: group._sum.quantity ?? 0,
        salesInCents: group._sum.totalAmountInCents ?? 0,
      };
    }),
  );
}

/** Every order created in the range, paid or not, by status. */
async function countOrdersByStatus(range: SalesDateRange): Promise<{ status: OrderStatus; count: number }[]> {
  const groups = await db.order.groupBy({
    by: ["status"],
    where: { createdAt: { gte: range.start, lt: range.end } },
    _count: { _all: true },
  });

  return groups.map((group) => ({ status: group.status, count: group._count._all }));
}

async function sumRefunds(range: SalesDateRange) {
  const refunds = await db.paymentTransaction.aggregate({
    where: { type: "REFUND", status: "SUCCEEDED", createdAt: { gte: range.start, lt: range.end } },
    _count: { _all: true },
    _sum: { amountInCents: true },
  });

  return { count: refunds._count._all, amountInCents: refunds._sum.amountInCents ?? 0 };
}

/** Marketplace-wide sales in the range, aggregated in the database without loading the orders. */
export async function getAdminSalesSummary(range: SalesDateRange) {
  const [stores, paidOrderCount, topProducts, ordersByStatus, refunds] = await Promise.all([
    listStoreSalesTotals(range),
    db.order.count({ where: { sellerOrders: { some: confirmedSellerOrdersIn(range) } } }),
    listTopProducts(range),
    countOrdersByStatus(range),
    sumRefunds(range),
  ]);
  const totals = sumSalesTotals(stores);

  return {
    ...totals,
    paidOrderCount,
    sellingStoreCount: stores.length,
    averageTicketInCents: averageTicketInCents(totals.grossSalesInCents, paidOrderCount),
    refunds,
    topStores: await listTopStores(stores),
    topProducts,
    ordersByStatus,
  };
}
