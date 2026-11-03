import { describe, expect, it } from "vitest";

import { buildStorePayoutReport, type StorePayoutReport } from "./store-payouts";
import { storePayoutsCsv } from "./store-payouts-csv";

function reportFor(storeName: string): StorePayoutReport {
  return buildStorePayoutReport({
    sales: [
      {
        sellerId: "seller-a",
        orderCount: 2,
        itemsSubtotalInCents: 4_435_650,
        sellerDiscountInCents: 40_394,
        marketplaceCommissionInCents: 532_282,
        sellerNetAmountInCents: 3_862_974,
        customerShippingAmountInCents: 59_800,
      },
    ],
    refunds: [],
    storeNames: new Map([["seller-a", storeName]]),
  });
}

function linesOf(csv: string) {
  return csv.replace(/^﻿/, "").split("\r\n");
}

describe("storePayoutsCsv", () => {
  it("starts with the UTF-8 BOM so Excel keeps the accents", () => {
    const csv = storePayoutsCsv(reportFor("Trilha Forte Motopeças"));

    expect(csv.startsWith("﻿")).toBe(true);
    expect(linesOf(csv)[0]).toBe(
      "Loja;Pedidos;Produtos (R$);Cupom da loja (R$);Comissão (R$);Líquido a repassar (R$);Frete do cliente (R$);Reembolsos (R$)",
    );
  });

  it("writes one line per store and a total, with semicolons and decimal commas", () => {
    const lines = linesOf(storePayoutsCsv(reportFor("Trilha Forte Motopeças")));

    expect(lines[1]).toBe("Trilha Forte Motopeças;2;44356,50;403,94;5322,82;38629,74;598,00;0,00");
    expect(lines[2]).toBe("Total;2;44356,50;403,94;5322,82;38629,74;598,00;0,00");
    expect(lines[3]).toBe("");
  });

  it.each(['=HYPERLINK("x")', "+55 Motos", "-Moto", "@Loja", "＠Loja", "＝1+1", "\tLoja"])(
    "keeps a store name starting with a formula sign as text: %s",
    (storeName) => {
      const storeCell = linesOf(storePayoutsCsv(reportFor(storeName)))[1]?.split(";")[0] ?? "";

      expect(storeCell.replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );

  it("quotes a store name with a semicolon or quote so the columns stay in place", () => {
    const line = linesOf(storePayoutsCsv(reportFor('Moto "Box"; Peças')))[1];

    expect(line?.startsWith('"Moto ""Box""; Peças";2;')).toBe(true);
  });

  it("lists the refunds no store could take before the total", () => {
    const report = buildStorePayoutReport({
      sales: [],
      refunds: [
        {
          amountInCents: 2_500,
          sellerOrderId: null,
          orderSellerOrders: [
            { id: "so-a", sellerId: "seller-a" },
            { id: "so-b", sellerId: "seller-b" },
          ],
        },
      ],
      storeNames: new Map(),
    });

    const lines = linesOf(storePayoutsCsv(report));

    expect(lines[1]).toBe("Reembolsos sem loja identificada;;;;;;;25,00");
    expect(lines[2]).toBe("Total;0;0,00;0,00;0,00;0,00;0,00;25,00");
  });
});
