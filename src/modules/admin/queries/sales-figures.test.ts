import { describe, expect, it } from "vitest";

import {
  averageTicketInCents,
  grossSalesInCents,
  rankStoresByGrossSales,
  sumSalesTotals,
  type StoreSalesTotals,
} from "./sales-figures";

function store(sellerId: string, overrides: Partial<StoreSalesTotals> = {}): StoreSalesTotals {
  return {
    sellerId,
    orderCount: 1,
    itemsSubtotalInCents: 10_000,
    discountAmountInCents: 0,
    customerShippingAmountInCents: 0,
    sellerNetAmountInCents: 8_800,
    marketplaceCommissionInCents: 1_200,
    ...overrides,
  };
}

describe("grossSalesInCents", () => {
  it("is what the customer paid: items minus every discount plus the shipping they paid", () => {
    const totals = store("a", {
      itemsSubtotalInCents: 10_000,
      discountAmountInCents: 500,
      customerShippingAmountInCents: 2_000,
    });

    expect(grossSalesInCents(totals)).toBe(11_500);
  });
});

describe("sumSalesTotals", () => {
  it("adds gross sales, store net amounts and the commission recorded on each order", () => {
    const totals = sumSalesTotals([
      store("a", { discountAmountInCents: 1_000, sellerNetAmountInCents: 7_920, marketplaceCommissionInCents: 1_080 }),
      store("b", {
        customerShippingAmountInCents: 3_000,
        sellerNetAmountInCents: 9_000,
        marketplaceCommissionInCents: 1_000,
      }),
    ]);

    expect(totals).toEqual({
      grossSalesInCents: 22_000,
      sellerNetAmountInCents: 16_920,
      marketplaceCommissionInCents: 2_080,
    });
  });

  it("is zero without sales", () => {
    expect(sumSalesTotals([])).toEqual({
      grossSalesInCents: 0,
      sellerNetAmountInCents: 0,
      marketplaceCommissionInCents: 0,
    });
  });
});

describe("rankStoresByGrossSales", () => {
  it("orders by gross sales, breaks ties by order count and keeps only the top of the list", () => {
    const ranked = rankStoresByGrossSales(
      [
        store("small"),
        store("shipping-heavy", { customerShippingAmountInCents: 5_000 }),
        store("tie-fewer-orders", { itemsSubtotalInCents: 12_000 }),
        store("tie-more-orders", { itemsSubtotalInCents: 12_000, orderCount: 3 }),
      ],
      3,
    );

    expect(ranked.map((entry) => entry.sellerId)).toEqual(["shipping-heavy", "tie-more-orders", "tie-fewer-orders"]);
    expect(ranked[0]).toEqual({ sellerId: "shipping-heavy", orderCount: 1, grossSalesInCents: 15_000 });
  });
});

describe("averageTicketInCents", () => {
  it("rounds to whole cents", () => {
    expect(averageTicketInCents(10_000, 3)).toBe(3_333);
    expect(averageTicketInCents(20_000, 3)).toBe(6_667);
  });

  it("has no value before the first paid order", () => {
    expect(averageTicketInCents(0, 0)).toBeNull();
  });
});
