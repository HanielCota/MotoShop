import type { Route } from "next";
import { Download } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatCount, formatMoneyInCents } from "@/lib/format";

import { adminHref } from "../../admin-href";
import { pageStorePayoutRows, type StorePayoutReport, type StorePayoutTotals } from "../../domain/store-payouts";
import { AdminCard, AdminFilterForm, AdminTable, cellClassName, FilterText } from "../admin-ui";

const cardId = "admin-sales-payouts";

/** The sales period plus the card's own search and page, as they sit in the URL. */
export type StorePayoutsParams = {
  salesPeriod: string;
  salesFrom: string | null;
  salesTo: string | null;
  payoutQ: string | null;
  payoutPage: number;
};

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

/** The sales period of the screen; the spreadsheet holds every store of it, whatever the search or page. */
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

/** The sales page with the card's search and page, back at the card instead of the top of the page. */
function payoutsHref(params: StorePayoutsParams, changes: Partial<StorePayoutsParams>): Route {
  return `${adminHref("sales", { ...params, ...changes }, { salesPeriod: "30d" })}#${cardId}` as Route;
}

function StoreSearchForm({ params }: { params: StorePayoutsParams }) {
  const periodOnly = { ...params, payoutQ: null, payoutPage: 1 };

  return (
    <AdminFilterForm resetHref={payoutsHref(periodOnly, {})} label="Buscar loja no repasse" action={`#${cardId}`}>
      <input type="hidden" name="salesPeriod" value={params.salesPeriod} />
      {params.salesFrom == null ? null : <input type="hidden" name="salesFrom" value={params.salesFrom} />}
      {params.salesTo == null ? null : <input type="hidden" name="salesTo" value={params.salesTo} />}
      <FilterText label="Buscar loja" name="payoutQ" value={params.payoutQ} placeholder="Nome da loja" />
    </AdminFilterForm>
  );
}

function SearchSummary({ query, matchCount }: { query: string; matchCount: number }) {
  const found =
    matchCount === 0
      ? `Nenhuma loja encontrada para “${query}”.`
      : `${formatCount(matchCount, "loja encontrada", "lojas encontradas")} para “${query}”.`;

  return (
    <p role="status" className="text-sm">
      {found} <span className="text-muted-foreground">A linha Total continua somando todas as lojas do período.</span>
    </p>
  );
}

/** Every store the marketplace owes for the period, with the spreadsheet the Admin pays them from. */
export function AdminStorePayoutsCard({ report, params }: { report: StorePayoutReport; params: StorePayoutsParams }) {
  const title = "Repasse por loja";
  if (report.rows.length === 0) {
    return (
      <AdminCard id={cardId} title={title}>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-foreground font-semibold">Nenhuma venda neste período</p>
          <p className="text-muted-foreground text-sm">
            Quando houver pedidos pagos, o repasse de cada loja aparece aqui.
          </p>
        </div>
      </AdminCard>
    );
  }

  const view = pageStorePayoutRows(report.rows, { query: params.payoutQ, page: params.payoutPage });

  return (
    <AdminCard
      id={cardId}
      title={title}
      description="Todas as lojas com venda paga ou reembolso no período. Líquido = produtos − cupom da loja − comissão (sem frete)."
      actions={
        <a href={storePayoutsDownloadHref(params)} className={buttonVariants()}>
          <Download aria-hidden="true" />
          Baixar planilha
        </a>
      }
    >
      <StoreSearchForm params={params} />
      {view.isSearching ? <SearchSummary query={params.payoutQ ?? ""} matchCount={view.matchCount} /> : null}
      <AdminTable
        caption={title}
        columns={columns}
        className="[&_th]:whitespace-nowrap [&_th:not(:first-child)]:text-right"
      >
        {view.rows.map((row) => (
          <tr key={row.sellerId}>
            <td className={cellClassName}>{row.storeName}</td>
            <td className={numberCellClassName}>{row.orderCount}</td>
            <MoneyCells totals={row} />
          </tr>
        ))}
        {/* Not a store: shown once, at the end of the full list, so it never reads as part of a search result. */}
        {report.unattributedRefundInCents > 0 && view.isSearching === false && view.isLastPage ? (
          <tr>
            <td className={cellClassName} colSpan={columns.length - 1}>
              Reembolsos sem loja identificada
            </td>
            <td className={numberCellClassName}>{formatMoneyInCents(report.unattributedRefundInCents)}</td>
          </tr>
        ) : null}
        <tr className="bg-muted/60 font-semibold">
          <td className={cellClassName}>
            Total do período
            <span className="text-muted-foreground block text-xs font-normal">
              {formatCount(report.rows.length, "loja", "lojas")}
            </span>
          </td>
          <td className={payoutCellClassName}>{report.totals.orderCount}</td>
          <MoneyCells totals={report.totals} emphasized />
        </tr>
      </AdminTable>
      <Pagination
        ariaLabel="Páginas do repasse por loja"
        page={view.page}
        pageCount={view.pageCount}
        previousHref={payoutsHref(params, { payoutPage: view.page - 1 })}
        nextHref={payoutsHref(params, { payoutPage: view.page + 1 })}
        summary={formatCount(view.matchCount, "loja", "lojas")}
      />
      <p className="text-muted-foreground text-xs">
        A soma do líquido é igual ao cartão “Líquido das lojas”. Frete e reembolsos aparecem à parte: o reembolso de um
        pedido cancelado já saiu do líquido; o de uma devolução ainda está dentro. Um pedido com mais de uma loja conta
        uma vez em cada loja.
      </p>
    </AdminCard>
  );
}
