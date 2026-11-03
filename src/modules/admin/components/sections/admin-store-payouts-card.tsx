import { Download } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { formatMoneyInCents } from "@/lib/format";

import type { StorePayoutReport, StorePayoutTotals } from "../../domain/store-payouts";
import { AdminCard, AdminTable, cellClassName } from "../admin-ui";

const columns = [
  "Loja",
  "Pedidos",
  "Produtos",
  "Cupom da loja",
  "Comissão",
  "Líquido a repassar",
  "Frete do cliente",
  "Reembolsos",
];
const numberCellClassName = `${cellClassName} text-right tabular-nums whitespace-nowrap`;
const payoutCellClassName = `${numberCellClassName} font-semibold`;

/** The sales period of the screen, so the spreadsheet holds the same stores the table shows. */
export function storePayoutsDownloadHref(period: {
  salesPeriod: string;
  salesFrom: string | null;
  salesTo: string | null;
}) {
  const query = new URLSearchParams({ salesPeriod: period.salesPeriod });
  if (period.salesFrom != null) query.set("salesFrom", period.salesFrom);
  if (period.salesTo != null) query.set("salesTo", period.salesTo);

  return `/api/admin/store-payouts?${query.toString()}`;
}

function MoneyCells({ totals, emphasized }: { totals: Omit<StorePayoutTotals, "orderCount">; emphasized?: boolean }) {
  const cellClass = emphasized ? payoutCellClassName : numberCellClassName;

  return (
    <>
      <td className={cellClass}>{formatMoneyInCents(totals.itemsSubtotalInCents)}</td>
      <td className={cellClass}>{formatMoneyInCents(totals.sellerDiscountInCents)}</td>
      <td className={cellClass}>{formatMoneyInCents(totals.marketplaceCommissionInCents)}</td>
      <td className={payoutCellClassName}>{formatMoneyInCents(totals.sellerNetAmountInCents)}</td>
      <td className={cellClass}>{formatMoneyInCents(totals.customerShippingAmountInCents)}</td>
      <td className={cellClass}>
        {formatMoneyInCents(totals.refundedInCents)}
        {totals.refundedOutsidePayoutInCents > 0 ? (
          <span className="text-muted-foreground block text-xs font-normal">
            {formatMoneyInCents(totals.refundedOutsidePayoutInCents)} já fora do líquido
          </span>
        ) : null}
      </td>
    </>
  );
}

/** Every store the marketplace owes for the period, with the spreadsheet the Admin pays them from. */
export function AdminStorePayoutsCard({ report, downloadHref }: { report: StorePayoutReport; downloadHref: string }) {
  const title = "Repasse por loja";
  if (report.rows.length === 0) {
    return (
      <AdminCard id="admin-sales-payouts" title={title}>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-foreground font-semibold">Nenhuma venda neste período</p>
          <p className="text-muted-foreground text-sm">
            Quando houver pedidos pagos, o repasse de cada loja aparece aqui.
          </p>
        </div>
      </AdminCard>
    );
  }

  return (
    <AdminCard
      id="admin-sales-payouts"
      title={title}
      description="Todas as lojas com venda paga ou reembolso no período. Líquido = produtos − cupom da loja − comissão (sem frete)."
      actions={
        <a href={downloadHref} className={buttonVariants()}>
          <Download aria-hidden="true" />
          Baixar planilha
        </a>
      }
    >
      <AdminTable
        caption={title}
        columns={columns}
        className="[&_th]:whitespace-nowrap [&_th:not(:first-child)]:text-right"
      >
        {report.rows.map((row) => (
          <tr key={row.sellerId}>
            <td className={cellClassName}>{row.storeName}</td>
            <td className={numberCellClassName}>{row.orderCount}</td>
            <MoneyCells totals={row} />
          </tr>
        ))}
        {report.unattributedRefundInCents > 0 ? (
          <tr>
            <td className={cellClassName} colSpan={columns.length - 1}>
              Reembolsos sem loja identificada
            </td>
            <td className={numberCellClassName}>{formatMoneyInCents(report.unattributedRefundInCents)}</td>
          </tr>
        ) : null}
        <tr className="bg-muted/60 font-semibold">
          <td className={cellClassName}>Total</td>
          <td className={payoutCellClassName}>{report.totals.orderCount}</td>
          <MoneyCells totals={report.totals} emphasized />
        </tr>
      </AdminTable>
      <p className="text-muted-foreground text-xs">
        A soma do líquido é igual ao cartão “Líquido das lojas”. Frete e reembolsos aparecem à parte: o reembolso de um
        pedido cancelado já saiu do líquido; o de uma devolução ainda está dentro. Um pedido com mais de uma loja conta
        uma vez em cada loja.
      </p>
    </AdminCard>
  );
}
