import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildStorePayoutReport } from "../../domain/store-payouts";
import { AdminStorePayoutsCard, storePayoutsDownloadHref } from "./admin-store-payouts-card";

afterEach(cleanup);

const report = buildStorePayoutReport({
  sales: [
    {
      sellerId: "seller-a",
      orderCount: 20,
      itemsSubtotalInCents: 4_435_650,
      sellerDiscountInCents: 0,
      marketplaceCommissionInCents: 532_282,
      sellerNetAmountInCents: 3_903_368,
      customerShippingAmountInCents: 59_800,
    },
  ],
  refunds: [
    {
      amountInCents: 25_480,
      sellerOrderId: null,
      orderSellerOrders: [{ id: "so-b", sellerId: "seller-b", countsAsSale: true }],
    },
  ],
  storeNames: new Map([
    ["seller-a", "Cross Center Campinas"],
    ["seller-b", "Box 77"],
  ]),
});

describe("AdminStorePayoutsCard", () => {
  it("shows each store's payout, a store with only a refund and the total", () => {
    render(<AdminStorePayoutsCard report={report} downloadHref="/api/admin/store-payouts?salesPeriod=30d" />);

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Cross Center Campinas");
    expect(rows[1]).toHaveTextContent("R$ 39.033,68");
    expect(rows[2]).toHaveTextContent("Box 77");
    expect(rows[2]).toHaveTextContent("R$ 254,80");
    expect(rows.at(-1)).toHaveTextContent("Total");
    expect(rows.at(-1)).toHaveTextContent("R$ 39.033,68");
  });

  it("says which part of a store's refunds already left the payout", () => {
    const cancelled = buildStorePayoutReport({
      sales: [],
      refunds: [
        {
          amountInCents: 10_000,
          sellerOrderId: "so-b",
          orderSellerOrders: [{ id: "so-b", sellerId: "seller-b", countsAsSale: false }],
        },
      ],
      storeNames: new Map([["seller-b", "Box 77"]]),
    });

    render(<AdminStorePayoutsCard report={cancelled} downloadHref="/api/admin/store-payouts?salesPeriod=30d" />);

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("R$ 100,00 já fora do líquido");
  });

  it("links the spreadsheet download of the same period", () => {
    render(<AdminStorePayoutsCard report={report} downloadHref="/api/admin/store-payouts?salesPeriod=30d" />);

    expect(screen.getByRole("link", { name: "Baixar planilha" })).toHaveAttribute(
      "href",
      "/api/admin/store-payouts?salesPeriod=30d",
    );
  });

  it("explains the empty period without a download button", () => {
    const empty = buildStorePayoutReport({ sales: [], refunds: [], storeNames: new Map() });

    render(<AdminStorePayoutsCard report={empty} downloadHref="/api/admin/store-payouts?salesPeriod=today" />);

    expect(screen.getByText("Nenhuma venda neste período")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Baixar planilha" })).toBeNull();
  });
});

describe("storePayoutsDownloadHref", () => {
  it("carries the custom dates only when they are set", () => {
    expect(storePayoutsDownloadHref({ salesPeriod: "30d", salesFrom: null, salesTo: null })).toBe(
      "/api/admin/store-payouts?salesPeriod=30d",
    );
    expect(storePayoutsDownloadHref({ salesPeriod: "custom", salesFrom: "01/06/2026", salesTo: "31/10/2026" })).toBe(
      "/api/admin/store-payouts?salesPeriod=custom&salesFrom=01%2F06%2F2026&salesTo=31%2F10%2F2026",
    );
  });
});
