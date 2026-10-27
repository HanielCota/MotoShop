/** Confirmed sales: the same statuses the Central do Lojista counts as sold. */
export const confirmedSellerOrderStatuses = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export const SALES_RANKING_SIZE = 5;

/** Sums of the confirmed seller orders of one store, as the database groups them. */
export type StoreSalesTotals = {
  sellerId: string;
  orderCount: number;
  itemsSubtotalInCents: number;
  discountAmountInCents: number;
  customerShippingAmountInCents: number;
  sellerNetAmountInCents: number;
  marketplaceCommissionInCents: number;
};

export type RankedStore = { sellerId: string; orderCount: number; grossSalesInCents: number };

/** What the customers paid for a store's part of the orders: items, minus discounts, plus their shipping. */
export function grossSalesInCents(totals: StoreSalesTotals) {
  return totals.itemsSubtotalInCents - totals.discountAmountInCents + totals.customerShippingAmountInCents;
}

export function sumSalesTotals(stores: readonly StoreSalesTotals[]) {
  return stores.reduce(
    (sum, store) => ({
      grossSalesInCents: sum.grossSalesInCents + grossSalesInCents(store),
      sellerNetAmountInCents: sum.sellerNetAmountInCents + store.sellerNetAmountInCents,
      marketplaceCommissionInCents: sum.marketplaceCommissionInCents + store.marketplaceCommissionInCents,
    }),
    { grossSalesInCents: 0, sellerNetAmountInCents: 0, marketplaceCommissionInCents: 0 },
  );
}

/** Stores by gross sales, highest first; ties keep the store with more orders on top. */
export function rankStoresByGrossSales(stores: readonly StoreSalesTotals[], size = SALES_RANKING_SIZE): RankedStore[] {
  return stores
    .map((store) => ({
      sellerId: store.sellerId,
      orderCount: store.orderCount,
      grossSalesInCents: grossSalesInCents(store),
    }))
    .toSorted(
      (first, second) => second.grossSalesInCents - first.grossSalesInCents || second.orderCount - first.orderCount,
    )
    .slice(0, size);
}

/** Whole cents, rounded; null before the first paid order, so the screen shows "—" instead of R$ 0,00. */
export function averageTicketInCents(grossSales: number, paidOrderCount: number) {
  if (paidOrderCount === 0) return null;

  return Math.round(grossSales / paidOrderCount);
}
