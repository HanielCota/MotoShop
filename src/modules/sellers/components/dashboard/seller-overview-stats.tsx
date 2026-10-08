import { CircleDollarSign, MessageCircleQuestion, PackageOpen, PackageSearch } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { formatMoneyInCents } from "@/lib/format";
import type { SellerDashboardPermissions } from "@/modules/sellers/application/get-seller-dashboard-context";
import {
  countSellerLowStockVariants,
  countSellerOrdersToPrepare,
  countSellerUnansweredQuestions,
  getSellerMonthNetSales,
  LOW_STOCK_THRESHOLD,
} from "@/modules/sellers/queries/seller-overview-metrics";

/** Indicadores da visão geral; cada cartão só aparece para quem pode abrir a página de destino. */
export async function SellerOverviewStats({
  sellerId,
  permissions,
}: {
  sellerId: string;
  permissions: SellerDashboardPermissions;
}) {
  const [ordersToPrepare, unansweredQuestions, lowStock, monthSales] = await Promise.all([
    permissions.canReadOrders ? countSellerOrdersToPrepare(sellerId) : null,
    permissions.canManageCatalog ? countSellerUnansweredQuestions(sellerId) : null,
    permissions.canManageCatalog ? countSellerLowStockVariants(sellerId) : null,
    permissions.canReadFinances ? getSellerMonthNetSales(sellerId) : null,
  ]);

  const cards = [
    ordersToPrepare !== null ? (
      <StatCard
        key="orders"
        label="Pedidos a preparar"
        value={ordersToPrepare}
        hint="Pagos ou em processamento"
        href="/seller/orders"
        icon={PackageOpen}
        tone={ordersToPrepare > 0 ? "attention" : "default"}
      />
    ) : null,
    unansweredQuestions !== null ? (
      <StatCard
        key="questions"
        label="Perguntas sem resposta"
        value={unansweredQuestions}
        hint="Responder ajuda a vender"
        href="/seller/questions?questionFilter=UNANSWERED"
        icon={MessageCircleQuestion}
        tone={unansweredQuestions > 0 ? "attention" : "default"}
      />
    ) : null,
    lowStock !== null ? (
      <StatCard
        key="stock"
        label="Estoque baixo"
        value={lowStock}
        hint={`Variações com até ${LOW_STOCK_THRESHOLD} unidades`}
        href="/seller#seller-stock"
        icon={PackageSearch}
        tone={lowStock > 0 ? "attention" : "default"}
      />
    ) : null,
    monthSales !== null ? (
      <StatCard
        key="sales"
        label="Vendas líquidas do mês"
        value={formatMoneyInCents(monthSales.netAmountInCents)}
        hint={`${monthSales.orderCount} ${monthSales.orderCount === 1 ? "pedido confirmado" : "pedidos confirmados"}`}
        href="/seller#seller-finance"
        icon={CircleDollarSign}
      />
    ) : null,
  ].filter(Boolean);

  if (cards.length === 0) return null;

  return (
    <section aria-label="Indicadores da loja" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards}
    </section>
  );
}
