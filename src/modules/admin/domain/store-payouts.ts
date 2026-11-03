import { ApplicationError } from "@/shared/errors/application-error";

/** Sums of the confirmed seller orders of one store in the period. */
export type StorePayoutSales = {
  sellerId: string;
  orderCount: number;
  itemsSubtotalInCents: number;
  sellerDiscountInCents: number;
  marketplaceCommissionInCents: number;
  sellerNetAmountInCents: number;
  customerShippingAmountInCents: number;
};

/** A completed refund and the seller orders of the order it was paid for. */
export type PayoutRefund = {
  amountInCents: number;
  /** Recorded by the post-sale refund flow; refunds made another way do not carry it. */
  sellerOrderId: string | null;
  orderSellerOrders: ReadonlyArray<{ id: string; sellerId: string }>;
};

export type StorePayoutRow = StorePayoutSales & { storeName: string; refundedInCents: number };

/** Column sums; `refundedInCents` also holds the refunds no store could take, as the "Reembolsos" card does. */
export type StorePayoutTotals = Omit<StorePayoutSales, "sellerId"> & { refundedInCents: number };

export type StorePayoutReport = {
  rows: StorePayoutRow[];
  totals: StorePayoutTotals;
  /** Refunds of orders split among several stores without the store recorded, so no row can take them. */
  unattributedRefundInCents: number;
};

const emptySales = {
  orderCount: 0,
  itemsSubtotalInCents: 0,
  sellerDiscountInCents: 0,
  marketplaceCommissionInCents: 0,
  sellerNetAmountInCents: 0,
  customerShippingAmountInCents: 0,
} as const satisfies Omit<StorePayoutSales, "sellerId">;

/** The seller a refund belongs to: the recorded seller order, or the only store of the order. */
function refundSellerId(refund: PayoutRefund): string | null {
  if (refund.sellerOrderId != null) {
    return refund.orderSellerOrders.find((sellerOrder) => sellerOrder.id === refund.sellerOrderId)?.sellerId ?? null;
  }

  const [onlySellerOrder, ...otherSellerOrders] = refund.orderSellerOrders;
  if (onlySellerOrder == null || otherSellerOrders.length > 0) return null;

  return onlySellerOrder.sellerId;
}

/**
 * Splits the period's completed refunds by store. A refund whose store cannot be told apart is kept
 * apart, so the refunds column still adds up to the "Reembolsos" card.
 */
export function sumRefundsBySeller(refunds: readonly PayoutRefund[]) {
  const bySeller = new Map<string, number>();
  let unattributedInCents = 0;

  for (const refund of refunds) {
    const sellerId = refundSellerId(refund);
    if (sellerId == null) {
      unattributedInCents += refund.amountInCents;
      continue;
    }

    bySeller.set(sellerId, (bySeller.get(sellerId) ?? 0) + refund.amountInCents);
  }

  return { bySeller, unattributedInCents };
}

/**
 * One row per store that sold or had a refund in the period, highest payout first, plus the totals.
 * The payout is the stored `sellerNetAmountInCents`: items minus the store's own coupon minus the
 * commission, without shipping, so its total matches the "Líquido das lojas" card.
 *
 * @param storeNames - Store name by seller id; every seller id of `sales` and `refunds` must have one.
 * @throws {ApplicationError} When a store name is missing, which means a seller order lost its store.
 */
export function buildStorePayoutReport(input: {
  sales: readonly StorePayoutSales[];
  refunds: readonly PayoutRefund[];
  storeNames: ReadonlyMap<string, string>;
}): StorePayoutReport {
  const refunds = sumRefundsBySeller(input.refunds);
  const salesBySeller = new Map(input.sales.map((store) => [store.sellerId, store]));
  const sellerIds = new Set(salesBySeller.keys()).union(new Set(refunds.bySeller.keys()));

  const rows = [...sellerIds]
    .map((sellerId) => {
      const storeName = input.storeNames.get(sellerId);
      if (storeName === undefined) {
        throw new ApplicationError({ code: "INTERNAL_ERROR", message: `Store name missing for seller ${sellerId}` });
      }

      return {
        ...emptySales,
        ...salesBySeller.get(sellerId),
        sellerId,
        storeName,
        refundedInCents: refunds.bySeller.get(sellerId) ?? 0,
      };
    })
    .toSorted(
      (first, second) =>
        second.sellerNetAmountInCents - first.sellerNetAmountInCents ||
        first.storeName.localeCompare(second.storeName, "pt-BR"),
    );

  const totals = sumStorePayouts(rows);

  return {
    rows,
    totals: { ...totals, refundedInCents: totals.refundedInCents + refunds.unattributedInCents },
    unattributedRefundInCents: refunds.unattributedInCents,
  };
}

function sumStorePayouts(rows: readonly StorePayoutRow[]): StorePayoutTotals {
  const totals: StorePayoutTotals = { ...emptySales, refundedInCents: 0 };

  for (const row of rows) {
    totals.orderCount += row.orderCount;
    totals.itemsSubtotalInCents += row.itemsSubtotalInCents;
    totals.sellerDiscountInCents += row.sellerDiscountInCents;
    totals.marketplaceCommissionInCents += row.marketplaceCommissionInCents;
    totals.sellerNetAmountInCents += row.sellerNetAmountInCents;
    totals.customerShippingAmountInCents += row.customerShippingAmountInCents;
    totals.refundedInCents += row.refundedInCents;
  }

  return totals;
}
