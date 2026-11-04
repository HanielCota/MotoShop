import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildStorePayoutReport, type StorePayoutSales } from "../../domain/store-payouts";
import { AdminStorePayoutsCard, storePayoutsDownloadHref, type StorePayoutsParams } from "./admin-store-payouts-card";

afterEach(cleanup);

const params: StorePayoutsParams = {
  salesPeriod: "custom",
  salesFrom: "01/06/2026",
  salesTo: "31/10/2026",
  payoutQ: null,
  payoutPage: 1,
};

function sales(sellerId: string, sellerNetAmountInCents: number): StorePayoutSales {
  return {
    sellerId,
    orderCount: 1,
    itemsSubtotalInCents: sellerNetAmountInCents,
    sellerDiscountInCents: 0,
    marketplaceCommissionInCents: 0,
    sellerNetAmountInCents,
    customerShippingAmountInCents: 0,
  };
}

/** Stores "Loja 01" to "Loja 25", "Loja 01" with the highest payout, so they sort by number. */
const manyStores = buildStorePayoutReport({
  sales: Array.from({ length: 25 }, (_, index) => sales(`seller-${index + 1}`, (26 - (index + 1)) * 1_000)),
  refunds: [],
  storeNames: new Map(
    Array.from({ length: 25 }, (_, index) => [`seller-${index + 1}`, `Loja ${String(index + 1).padStart(2, "0")}`]),
  ),
});

function tableRows() {
  return within(screen.getByRole("table")).getAllByRole("row");
}

describe("AdminStorePayoutsCard", () => {
  it("shows each store's payout, a store with only a refund and the total", () => {
    const report = buildStorePayoutReport({
      sales: [{ ...sales("seller-a", 3_903_368), orderCount: 20 }],
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

    render(<AdminStorePayoutsCard report={report} params={params} />);

    const rows = tableRows();
    expect(rows[1]).toHaveTextContent("Cross Center Campinas");
    expect(rows[1]).toHaveTextContent("R$ 39.033,68");
    expect(rows[2]).toHaveTextContent("Box 77");
    expect(rows[2]).toHaveTextContent("R$ 254,80");
    expect(rows.at(-1)).toHaveTextContent("Total do período");
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

    render(<AdminStorePayoutsCard report={cancelled} params={params} />);

    expect(tableRows()[1]).toHaveTextContent("R$ 100,00 já fora do líquido");
  });

  it("shows 20 stores per page and links the next page, keeping the period", () => {
    render(<AdminStorePayoutsCard report={manyStores} params={params} />);

    const rows = tableRows();
    expect(rows).toHaveLength(22);
    expect(rows[1]).toHaveTextContent("Loja 01");
    expect(rows[20]).toHaveTextContent("Loja 20");
    expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/sales?salesPeriod=custom&salesFrom=01%2F06%2F2026&salesTo=31%2F10%2F2026&payoutPage=2#admin-sales-payouts",
    );
  });

  it("shows the rest on page 2 with the total of every store of the period", () => {
    render(<AdminStorePayoutsCard report={manyStores} params={{ ...params, payoutPage: 2 }} />);

    const rows = tableRows();
    expect(rows).toHaveLength(7);
    expect(rows[1]).toHaveTextContent("Loja 21");
    expect(rows.at(-1)).toHaveTextContent("25 lojas");
    expect(rows.at(-1)).toHaveTextContent("R$ 3.250,00");
  });

  it("filters the stores by name but keeps the period total, and says so", () => {
    render(<AdminStorePayoutsCard report={manyStores} params={{ ...params, payoutQ: "loja 2" }} />);

    const rows = tableRows();
    expect(rows.slice(1, -1).map((row) => row.querySelector("td")?.textContent)).toEqual([
      "Loja 20",
      "Loja 21",
      "Loja 22",
      "Loja 23",
      "Loja 24",
      "Loja 25",
    ]);
    expect(rows.at(-1)).toHaveTextContent("R$ 3.250,00");
    expect(screen.getByRole("status")).toHaveTextContent(
      "6 lojas encontradas para “loja 2”. A linha Total continua somando todas as lojas do período.",
    );
  });

  it("tells when no store matches the search, still showing the period total", () => {
    render(<AdminStorePayoutsCard report={manyStores} params={{ ...params, payoutQ: "Garagem" }} />);

    expect(screen.getByRole("status")).toHaveTextContent("Nenhuma loja encontrada para “Garagem”.");
    expect(tableRows()).toHaveLength(2);
    expect(tableRows()[1]).toHaveTextContent("R$ 3.250,00");
  });

  it("downloads the whole period, whatever the search or page", () => {
    render(<AdminStorePayoutsCard report={manyStores} params={{ ...params, payoutQ: "loja 2", payoutPage: 2 }} />);

    expect(screen.getByRole("link", { name: "Baixar planilha" })).toHaveAttribute(
      "href",
      "/api/admin/store-payouts?salesPeriod=custom&salesFrom=01%2F06%2F2026&salesTo=31%2F10%2F2026",
    );
  });

  it("explains the empty period without a download button", () => {
    const empty = buildStorePayoutReport({ sales: [], refunds: [], storeNames: new Map() });

    render(<AdminStorePayoutsCard report={empty} params={params} />);

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
