import Link from "next/link";
import type { ReactNode } from "react";

import { StatCard } from "@/components/ui/stat-card";
import { OrderStatus } from "@/generated/prisma/enums";
import { formatCount, formatDate, formatMoneyInCents, formatPercentFromBps } from "@/lib/format";
import { getStatusLabel } from "@/shared/presentation/status-labels";

import { adminHref } from "../../admin-href";
import { getMarketplaceConfiguration } from "../../queries/marketplace-configuration";
import { lastDayOf, resolveSalesDateRange, type SalesDateRange, type SalesPeriod } from "../../queries/sales-period";
import { getAdminSalesSummary, type AdminSalesSummary } from "../../queries/sales-summary";
import { loadAdminSalesSearchParams } from "../../search-params";
import { AdminCard, AdminFilterForm, AdminTable, cellClassName, FilterDateRange } from "../admin-ui";
import type { AdminSectionProps } from "./types";

const periodOptions: { value: SalesPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "month", label: "Mês atual" },
  { value: "custom", label: "Escolher datas" },
];

const orderStatusOrder = Object.values(OrderStatus);

export async function AdminSalesSection({ searchParams }: AdminSectionProps) {
  const params = await loadAdminSalesSearchParams(searchParams);
  const range = resolveSalesDateRange({
    period: params.salesPeriod,
    from: params.salesFrom,
    to: params.salesTo,
  });

  return (
    <div className="space-y-4">
      <PeriodFilter selected={params.salesPeriod} />
      {params.salesPeriod === "custom" ? <CustomRangeForm from={params.salesFrom} to={params.salesTo} /> : null}
      {range == null ? <MissingRangeHint from={params.salesFrom} to={params.salesTo} /> : <SalesPanel range={range} />}
    </div>
  );
}

function PeriodFilter({ selected }: { selected: SalesPeriod }) {
  return (
    <nav aria-label="Período" className="flex flex-wrap gap-2">
      {periodOptions.map((option) => (
        <Link
          key={option.value}
          href={adminHref("sales", { salesPeriod: option.value }, { salesPeriod: "30d" })}
          aria-current={option.value === selected ? "page" : undefined}
          className="hover:bg-muted aria-[current=page]:bg-foreground aria-[current=page]:text-background inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-semibold whitespace-nowrap transition-colors sm:min-h-9"
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

function CustomRangeForm({ from, to }: { from: string | null; to: string | null }) {
  return (
    <AdminFilterForm resetHref={adminHref("sales", {})} label="Escolher datas">
      <input type="hidden" name="salesPeriod" value="custom" />
      <FilterDateRange fromName="salesFrom" toName="salesTo" from={from} to={to} />
    </AdminFilterForm>
  );
}

/** Invalid or inverted dates are already explained under the date fields; only a missing date needs this hint. */
function MissingRangeHint({ from, to }: { from: string | null; to: string | null }) {
  if (from != null && to != null) return null;

  return <p className="text-muted-foreground text-sm">Escolha a data inicial e a final para ver as vendas.</p>;
}

function describeRange(range: SalesDateRange) {
  const firstDay = formatDate(range.start);
  const lastDay = formatDate(lastDayOf(range));

  return firstDay === lastDay ? firstDay : `${firstDay} a ${lastDay}`;
}

async function SalesPanel({ range }: { range: SalesDateRange }) {
  const [summary, configuration] = await Promise.all([getAdminSalesSummary(range), getMarketplaceConfiguration()]);
  const commissionHint =
    configuration == null
      ? "O percentual gravado em cada pedido"
      : `${formatPercentFromBps(configuration.defaultCommissionBps)} padrão, ou o da loja`;

  return (
    <>
      <p className="text-muted-foreground text-sm">{describeRange(range)} · só pedidos com pagamento confirmado</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Vendas brutas"
          value={formatMoneyInCents(summary.grossSalesInCents)}
          hint="Pago pelos clientes, com frete"
        />
        <StatCard
          label="Líquido das lojas"
          value={formatMoneyInCents(summary.sellerNetAmountInCents)}
          hint="Depois da comissão e dos cupons das lojas"
        />
        <StatCard
          label="Comissão do Moto Shop"
          value={formatMoneyInCents(summary.marketplaceCommissionInCents)}
          hint={commissionHint}
        />
        <StatCard
          label="Pedidos pagos"
          value={summary.paidOrderCount}
          hint={
            summary.sellingStoreCount === 0
              ? "Nenhuma loja vendeu ainda"
              : `Vendas em ${formatCount(summary.sellingStoreCount, "loja", "lojas")}`
          }
        />
        <StatCard
          label="Ticket médio"
          value={summary.averageTicketInCents == null ? "—" : formatMoneyInCents(summary.averageTicketInCents)}
          hint={summary.averageTicketInCents == null ? "Aparece com a primeira venda" : "Vendas brutas ÷ pedidos"}
        />
        <StatCard
          label="Reembolsos"
          value={formatMoneyInCents(summary.refunds.amountInCents)}
          hint={
            summary.refunds.count === 0
              ? "Nenhum reembolso"
              : formatCount(summary.refunds.count, "reembolso concluído", "reembolsos concluídos")
          }
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <TopStores stores={summary.topStores} />
        <TopProducts products={summary.topProducts} />
      </div>
      <OrdersByStatus ordersByStatus={summary.ordersByStatus} />
    </>
  );
}

function RankingCard({
  id,
  title,
  description,
  emptyDescription,
  isEmpty,
  children,
}: {
  id: string;
  title: string;
  description: string;
  emptyDescription: string;
  isEmpty: boolean;
  children: ReactNode;
}) {
  if (isEmpty) {
    return (
      <AdminCard id={id} title={title}>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-foreground font-semibold">Nenhuma venda neste período</p>
          <p className="text-muted-foreground text-sm">{emptyDescription}</p>
        </div>
      </AdminCard>
    );
  }

  return (
    <AdminCard id={id} title={title} description={description}>
      {children}
    </AdminCard>
  );
}

const numberCellClassName = `${cellClassName} text-right tabular-nums`;
/** Number columns line up on the right, header included, as in the approved board. */
const rankingTableClassName = "[&_th:not(:first-child)]:text-right";

function TopStores({ stores }: { stores: AdminSalesSummary["topStores"] }) {
  return (
    <RankingCard
      id="admin-sales-stores"
      title="Lojas que mais venderam"
      description="Por vendas brutas no período."
      emptyDescription="Quando houver pedidos pagos, o ranking das lojas aparece aqui."
      isEmpty={stores.length === 0}
    >
      <AdminTable
        caption="Lojas que mais venderam"
        columns={["Loja", "Pedidos", "Vendas"]}
        minWidth="min-w-0"
        className={rankingTableClassName}
      >
        {stores.map((store) => (
          <tr key={store.sellerId}>
            <td className={cellClassName}>{store.storeName}</td>
            <td className={numberCellClassName}>{store.orderCount}</td>
            <td className={numberCellClassName}>{formatMoneyInCents(store.grossSalesInCents)}</td>
          </tr>
        ))}
      </AdminTable>
    </RankingCard>
  );
}

function TopProducts({ products }: { products: AdminSalesSummary["topProducts"] }) {
  return (
    <RankingCard
      id="admin-sales-products"
      title="Produtos mais vendidos"
      description="Por quantidade, com o SKU da variação."
      emptyDescription="Os produtos mais vendidos, com o SKU da variação, aparecem aqui."
      isEmpty={products.length === 0}
    >
      <AdminTable
        caption="Produtos mais vendidos"
        columns={["Produto", "Qtd.", "Vendas"]}
        minWidth="min-w-0"
        className={rankingTableClassName}
      >
        {products.map((product) => (
          <tr key={`${product.sellerId}:${product.sku}`}>
            <td className={cellClassName}>
              <span className="block break-words">{product.productName}</span>
              <span className="text-muted-foreground block text-xs break-all">{product.sku}</span>
            </td>
            <td className={numberCellClassName}>{product.quantity}</td>
            <td className={numberCellClassName}>{formatMoneyInCents(product.salesInCents)}</td>
          </tr>
        ))}
      </AdminTable>
    </RankingCard>
  );
}

function OrdersByStatus({ ordersByStatus }: { ordersByStatus: AdminSalesSummary["ordersByStatus"] }) {
  if (ordersByStatus.length === 0) return null;

  const rows = ordersByStatus.toSorted(
    (first, second) => orderStatusOrder.indexOf(first.status) - orderStatusOrder.indexOf(second.status),
  );
  const largestCount = Math.max(...rows.map((row) => row.count));

  return (
    <AdminCard
      id="admin-sales-statuses"
      title="Pedidos por status"
      description="Todos os pedidos criados no período, inclusive os não pagos."
    >
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.status} className="space-y-1">
            <div className="flex justify-between gap-3 text-sm">
              <span>{getStatusLabel("order", row.status)}</span>
              <span className="font-semibold tabular-nums">{row.count}</span>
            </div>
            <div aria-hidden="true" className="bg-muted h-2 rounded-full">
              <div
                className="bg-moto-brand h-2 rounded-full"
                style={{ width: `${Math.round((row.count / largestCount) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </AdminCard>
  );
}
