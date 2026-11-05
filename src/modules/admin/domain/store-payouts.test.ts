import { describe, expect, it } from "vitest";

import {
  buildStorePayoutReport,
  pageStorePayoutRows,
  sumRefundsBySeller,
  type StorePayoutSales,
} from "./store-payouts";

function sales(sellerId: string, sellerNetAmountInCents: number, overrides: Partial<StorePayoutSales> = {}) {
  return {
    sellerId,
    orderCount: 1,
    itemsSubtotalInCents: 10_000,
    sellerDiscountInCents: 0,
    marketplaceCommissionInCents: 1_200,
    sellerNetAmountInCents,
    customerShippingAmountInCents: 2_000,
    ...overrides,
  };
}

const storeNames = new Map([
  ["seller-a", "Garagem MX"],
  ["seller-b", "Box 77"],
  ["seller-c", "Areia Motos"],
]);

describe("sumRefundsBySeller", () => {
  it("gives a refund to the seller order the post-sale flow recorded", () => {
    const refunds = sumRefundsBySeller([
      {
        amountInCents: 4_990,
        sellerOrderId: "so-b",
        orderSellerOrders: [
          { id: "so-a", sellerId: "seller-a", countsAsSale: true },
          { id: "so-b", sellerId: "seller-b", countsAsSale: true },
        ],
      },
    ]);

    expect(refunds.bySeller.get("seller-b")?.refundedInCents).toBe(4_990);
    expect(refunds.bySeller.has("seller-a")).toBe(false);
    expect(refunds.unattributedInCents).toBe(0);
  });

  it("marks a refund of a cancelled seller order as already outside the payout, unlike a return refund", () => {
    const refunds = sumRefundsBySeller([
      {
        amountInCents: 10_000,
        sellerOrderId: "so-a",
        orderSellerOrders: [{ id: "so-a", sellerId: "seller-a", countsAsSale: false }],
      },
      {
        amountInCents: 5_000,
        sellerOrderId: "so-c",
        orderSellerOrders: [{ id: "so-c", sellerId: "seller-a", countsAsSale: true }],
      },
    ]);

    expect(refunds.bySeller.get("seller-a")).toEqual({ refundedInCents: 15_000, refundedOutsidePayoutInCents: 10_000 });
  });

  it("gives a refund without a recorded store to the only store of the order", () => {
    const refunds = sumRefundsBySeller([
      {
        amountInCents: 1_000,
        sellerOrderId: null,
        orderSellerOrders: [{ id: "so-a", sellerId: "seller-a", countsAsSale: true }],
      },
    ]);

    expect(refunds.bySeller.get("seller-a")?.refundedInCents).toBe(1_000);
  });

  it("keeps apart a refund of an order split among stores when no store was recorded", () => {
    const refunds = sumRefundsBySeller([
      {
        amountInCents: 2_500,
        sellerOrderId: null,
        orderSellerOrders: [
          { id: "so-a", sellerId: "seller-a", countsAsSale: true },
          { id: "so-b", sellerId: "seller-b", countsAsSale: true },
        ],
      },
    ]);

    expect(refunds.bySeller.size).toBe(0);
    expect(refunds.unattributedInCents).toBe(2_500);
  });

  it("keeps apart a refund whose recorded seller order is not in the order", () => {
    const refunds = sumRefundsBySeller([
      {
        amountInCents: 700,
        sellerOrderId: "so-x",
        orderSellerOrders: [{ id: "so-a", sellerId: "seller-a", countsAsSale: true }],
      },
    ]);

    expect(refunds.unattributedInCents).toBe(700);
  });
});

describe("buildStorePayoutReport", () => {
  it("lists every store that sold, highest payout first, and sums the payouts as the sales card does", () => {
    const report = buildStorePayoutReport({
      sales: [sales("seller-a", 8_800), sales("seller-b", 25_000, { orderCount: 3, sellerDiscountInCents: 500 })],
      refunds: [],
      storeNames,
    });

    expect(report.rows.map((row) => row.storeName)).toEqual(["Box 77", "Garagem MX"]);
    expect(report.totals.sellerNetAmountInCents).toBe(33_800);
    expect(report.totals.orderCount).toBe(4);
    expect(report.totals.sellerDiscountInCents).toBe(500);
    expect(report.totals.customerShippingAmountInCents).toBe(4_000);
  });

  it("lists a store that only had a refund in the period, with zero sales", () => {
    const report = buildStorePayoutReport({
      sales: [sales("seller-a", 8_800)],
      refunds: [
        {
          amountInCents: 3_000,
          sellerOrderId: null,
          orderSellerOrders: [{ id: "so-c", sellerId: "seller-c", countsAsSale: true }],
        },
      ],
      storeNames,
    });

    const refundedOnly = report.rows.find((row) => row.sellerId === "seller-c");
    expect(refundedOnly).toMatchObject({ storeName: "Areia Motos", orderCount: 0, sellerNetAmountInCents: 0 });
    expect(refundedOnly?.refundedInCents).toBe(3_000);
  });

  it("counts the refunds no store could take in the total, as the refunds card does", () => {
    const report = buildStorePayoutReport({
      sales: [sales("seller-a", 8_800)],
      refunds: [
        {
          amountInCents: 1_000,
          sellerOrderId: null,
          orderSellerOrders: [{ id: "so-a", sellerId: "seller-a", countsAsSale: true }],
        },
        {
          amountInCents: 2_500,
          sellerOrderId: null,
          orderSellerOrders: [
            { id: "so-a", sellerId: "seller-a", countsAsSale: true },
            { id: "so-b", sellerId: "seller-b", countsAsSale: true },
          ],
        },
      ],
      storeNames,
    });

    expect(report.rows[0]?.refundedInCents).toBe(1_000);
    expect(report.unattributedRefundInCents).toBe(2_500);
    expect(report.totals.refundedInCents).toBe(3_500);
  });

  it("orders stores with the same payout by name", () => {
    const report = buildStorePayoutReport({
      sales: [sales("seller-a", 5_000), sales("seller-c", 5_000)],
      refunds: [],
      storeNames,
    });

    expect(report.rows.map((row) => row.storeName)).toEqual(["Areia Motos", "Garagem MX"]);
  });

  it("returns no rows and zero totals when nothing sold", () => {
    const report = buildStorePayoutReport({ sales: [], refunds: [], storeNames });

    expect(report.rows).toEqual([]);
    expect(report.totals.sellerNetAmountInCents).toBe(0);
  });

  it("throws when a store name is missing", () => {
    expect(() => buildStorePayoutReport({ sales: [sales("seller-z", 1)], refunds: [], storeNames })).toThrow(
      "Store name missing for seller seller-z",
    );
  });
});

describe("pageStorePayoutRows", () => {
  const rows = buildStorePayoutReport({
    sales: [sales("seller-a", 8_000), sales("seller-b", 6_000), sales("seller-c", 4_000)],
    refunds: [],
    storeNames: new Map([
      ["seller-a", "Garagem MX"],
      ["seller-b", "Trilha Forte Motopeças"],
      ["seller-c", "Areia Motos"],
    ]),
  }).rows;

  it("cuts the list into pages of the given size", () => {
    const view = pageStorePayoutRows(rows, { query: null, page: 2, pageSize: 2 });

    expect(view.rows.map((row) => row.storeName)).toEqual(["Areia Motos"]);
    expect(view).toMatchObject({ page: 2, pageCount: 2, matchCount: 3, isSearching: false });
  });

  it("finds a store ignoring case and accents", () => {
    const view = pageStorePayoutRows(rows, { query: "  MOTOPECAS ", page: 1 });

    expect(view.rows.map((row) => row.storeName)).toEqual(["Trilha Forte Motopeças"]);
    expect(view.isSearching).toBe(true);
  });

  it("shows the last page when the page asked for is past the end", () => {
    const view = pageStorePayoutRows(rows, { query: "motos", page: 9 });

    expect(view).toMatchObject({ page: 1, pageCount: 1, matchCount: 1 });
  });

  it("returns no rows and one empty page when nothing matches", () => {
    const view = pageStorePayoutRows(rows, { query: "Box", page: 1 });

    expect(view).toMatchObject({ rows: [], page: 1, pageCount: 1, matchCount: 0 });
  });

  it("shows the first page for a page number that is not a number", () => {
    const view = pageStorePayoutRows(rows, { query: null, page: Number.NaN, pageSize: 2 });

    expect(view).toMatchObject({ page: 1, pageCount: 2, isLastPage: false });
    expect(view.rows).toHaveLength(2);
  });

  it("treats a blank search as no search", () => {
    expect(pageStorePayoutRows(rows, { query: "   ", page: 1 }).isSearching).toBe(false);
  });
});
