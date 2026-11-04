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

/** A seller order of a refunded order; `countsAsSale` is false once it was cancelled. */
export type PayoutRefundSellerOrder = { id: string; sellerId: string; countsAsSale: boolean };

/** A completed refund and the seller orders of the order it was paid for. */
export type PayoutRefund = {
  amountInCents: number;
  /** Recorded by the post-sale refund flow; refunds made another way do not carry it. */
  sellerOrderId: string | null;
  orderSellerOrders: readonly PayoutRefundSellerOrder[];
};

type RefundSums = {
  refundedInCents: number;
  /** Refunds of cancelled seller orders, which already left the payout; return refunds are still inside it. */
  refundedOutsidePayoutInCents: number;
};

export type StorePayoutRow = StorePayoutSales & RefundSums & { storeName: string };

/** Column sums; `refundedInCents` also holds the refunds no store could take, as the "Reembolsos" card does. */
export type StorePayoutTotals = Omit<StorePayoutSales, "sellerId"> & RefundSums;

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

const noRefunds = { refundedInCents: 0, refundedOutsidePayoutInCents: 0 } as const satisfies RefundSums;

/** The seller order a refund belongs to: the recorded one, or the only one of the order. */
function refundedSellerOrder(refund: PayoutRefund): PayoutRefundSellerOrder | null {
  if (refund.sellerOrderId != null) {
    return refund.orderSellerOrders.find((sellerOrder) => sellerOrder.id === refund.sellerOrderId) ?? null;
  }

  const [onlySellerOrder, ...otherSellerOrders] = refund.orderSellerOrders;
  if (onlySellerOrder == null || otherSellerOrders.length > 0) return null;

  return onlySellerOrder;
}

/**
 * Splits the period's completed refunds by store. A refund whose store cannot be told apart is kept
 * apart, so the refunds column still adds up to the "Reembolsos" card.
 */
export function sumRefundsBySeller(refunds: readonly PayoutRefund[]) {
  const bySeller = new Map<string, RefundSums>();
  let unattributedInCents = 0;

  for (const refund of refunds) {
    const sellerOrder = refundedSellerOrder(refund);
    if (sellerOrder == null) {
      unattributedInCents += refund.amountInCents;
      continue;
    }

    const current = bySeller.get(sellerOrder.sellerId) ?? noRefunds;
    const outsidePayoutInCents = sellerOrder.countsAsSale ? 0 : refund.amountInCents;
    bySeller.set(sellerOrder.sellerId, {
      refundedInCents: current.refundedInCents + refund.amountInCents,
      refundedOutsidePayoutInCents: current.refundedOutsidePayoutInCents + outsidePayoutInCents,
    });
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
        ...(refunds.bySeller.get(sellerId) ?? noRefunds),
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
  const totals: StorePayoutTotals = { ...emptySales, ...noRefunds };

  for (const row of rows) {
    totals.orderCount += row.orderCount;
    totals.itemsSubtotalInCents += row.itemsSubtotalInCents;
    totals.sellerDiscountInCents += row.sellerDiscountInCents;
    totals.marketplaceCommissionInCents += row.marketplaceCommissionInCents;
    totals.sellerNetAmountInCents += row.sellerNetAmountInCents;
    totals.customerShippingAmountInCents += row.customerShippingAmountInCents;
    totals.refundedInCents += row.refundedInCents;
    totals.refundedOutsidePayoutInCents += row.refundedOutsidePayoutInCents;
  }

  return totals;
}

const STORE_PAYOUT_PAGE_SIZE = 20;
/** Longer than any store name; the search text comes from the URL. */
const MAX_STORE_SEARCH_LENGTH = 100;

/** Lower case without accents, so "motopecas" finds "Motopeças". */
function searchableName(value: string) {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

/**
 * The stores of one page of the payout list, after an optional name search. The page is cut here, after
 * the report is built, because the list is ordered by each store's summed payout and also holds stores
 * that only had a refund: the database cannot page that order without summing every store first, and a
 * period has at most a few hundred stores. The totals stay those of the whole report.
 *
 * @param page - Requested page, 1-based; a page past the end shows the last one.
 */
export function pageStorePayoutRows(
  rows: readonly StorePayoutRow[],
  options: { query: string | null; page: number; pageSize?: number },
) {
  const pageSize = options.pageSize ?? STORE_PAYOUT_PAGE_SIZE;
  const search = options.query == null ? "" : searchableName(options.query.slice(0, MAX_STORE_SEARCH_LENGTH));
  const matches = search === "" ? rows : rows.filter((row) => searchableName(row.storeName).includes(search));
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(Math.max(1, Math.trunc(options.page)), pageCount);

  return {
    rows: matches.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageCount,
    matchCount: matches.length,
    isSearching: search !== "",
  };
}
