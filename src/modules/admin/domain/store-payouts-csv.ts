import { formatMoneyInCentsForSpreadsheet } from "@/lib/format";

import type { StorePayoutReport, StorePayoutTotals } from "./store-payouts";

/** Excel in Portuguese splits columns on ";" and needs the BOM to read the file as UTF-8 (accents). */
const CSV_SEPARATOR = ";";
const CSV_LINE_BREAK = "\r\n";
const UTF8_BOM = "﻿";

/** Characters that make a spreadsheet read a cell as a formula, full-width forms included. */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r", "＝", "＋", "－", "＠"];
const QUOTE_TRIGGERS = /[";\r\n]/;

const header = [
  "Loja",
  "Pedidos",
  "Produtos (R$)",
  "Cupom da loja (R$)",
  "Comissão (R$)",
  "Líquido a repassar (R$)",
  "Frete do cliente (R$)",
  "Reembolsos (R$)",
];

/** Text typed by a store: a leading apostrophe keeps a name such as "=HYPERLINK(...)" as plain text. */
function textCell(value: string): string {
  const safeValue = FORMULA_TRIGGERS.some((trigger) => value.startsWith(trigger)) ? `'${value}` : value;
  if (QUOTE_TRIGGERS.test(safeValue) === false) return safeValue;

  return `"${safeValue.replaceAll('"', '""')}"`;
}

function moneyCells(totals: Omit<StorePayoutTotals, "orderCount">): string[] {
  return [
    totals.itemsSubtotalInCents,
    totals.sellerDiscountInCents,
    totals.marketplaceCommissionInCents,
    totals.sellerNetAmountInCents,
    totals.customerShippingAmountInCents,
    totals.refundedInCents,
  ].map(formatMoneyInCentsForSpreadsheet);
}

/**
 * The store payout list as a CSV that Excel in Portuguese opens in columns, with accents and numbers
 * it can sum: one line per store, the refunds no store could take (when any), then the total.
 */
export function storePayoutsCsv(report: StorePayoutReport): string {
  const storeLines = report.rows.map((row) => [textCell(row.storeName), String(row.orderCount), ...moneyCells(row)]);
  const unattributedLines =
    report.unattributedRefundInCents > 0
      ? [
          [
            textCell("Reembolsos sem loja identificada"),
            ...Array.from({ length: header.length - 2 }, () => ""),
            formatMoneyInCentsForSpreadsheet(report.unattributedRefundInCents),
          ],
        ]
      : [];
  const lines = [
    header.map(textCell),
    ...storeLines,
    ...unattributedLines,
    ["Total", String(report.totals.orderCount), ...moneyCells(report.totals)],
  ];

  return UTF8_BOM + lines.map((cells) => cells.join(CSV_SEPARATOR)).join(CSV_LINE_BREAK) + CSV_LINE_BREAK;
}
