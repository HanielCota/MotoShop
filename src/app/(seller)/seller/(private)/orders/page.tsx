import { Disclosure } from "@/components/ui/disclosure";
import { FilterDateRange, FilterForm, FilterSelect, FilterText } from "@/components/ui/filter-form";
import { Pagination } from "@/components/ui/pagination";
import type { Metadata, Route } from "next";
import { createSerializer } from "nuqs/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatMoneyInCents } from "@/lib/format";
import { getStatusOptions } from "@/shared/presentation/status-labels";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { ShipmentActions } from "@/modules/shipping/components/shipment-actions";
import { OwnShipmentActions } from "@/modules/shipping/components/own-shipping-forms";
import { hasSellerPermission } from "@/modules/auth/domain/seller-permissions";
import { SellerOrderAfterSales } from "@/modules/returns/components/seller-order-after-sales";
import { canAdvanceOwnShipment } from "@/modules/shipping/domain/own-shipping";
import { SellerOrderDelivery } from "@/modules/shipping/components/seller-order-delivery";
import { SellerOrderQueueTabs } from "@/modules/shipping/components/seller-order-queue-tabs";
import {
  countSellerOrdersInQueue,
  resolveSellerOrderQueue,
  type SellerOrderQueue,
} from "@/modules/shipping/domain/seller-order-queue";
import { countSellerOrdersByStatus, listSellerOrders } from "@/modules/shipping/queries/seller-orders";
import {
  loadSellerOrdersSearchParams,
  sellerOrderStatusValues,
  sellerOrdersSearchParams,
  shipmentStatusValues,
} from "@/modules/shipping/search-params";
import { domainIcons } from "@/shared/presentation/domain-icons";

export const metadata: Metadata = {
  title: "Pedidos · Central do Lojista",
  robots: { index: false, follow: false },
};

const serializeSellerOrdersSearchParams = createSerializer(sellerOrdersSearchParams);
const basePath = "/seller/orders";
const orderStatusOptions = getStatusOptions("sellerOrder").filter(({ value }) =>
  (sellerOrderStatusValues as readonly string[]).includes(value),
);
const shipmentStatusOptions = getStatusOptions("shipment").filter(({ value }) =>
  (shipmentStatusValues as readonly string[]).includes(value),
);
const orderStatusFilterOptions = [{ value: "ALL", label: "Todos" }, ...orderStatusOptions];
const shipmentStatusFilterOptions = [{ value: "ALL", label: "Todos" }, ...shipmentStatusOptions];
const emptyQueueTitles: Record<SellerOrderQueue, string> = {
  TO_PREPARE: "Nenhum pedido para preparar agora.",
  AWAITING_PAYMENT: "Nenhum pedido aguardando pagamento.",
  SHIPPED: "Nenhum pedido enviado ainda.",
  ALL: "Ainda não há pedidos na loja.",
};
const sortOptions = [
  { value: "newest", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
];

export default async function SellerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireSellerAccess("ORDER_READ");
  const params = await loadSellerOrdersSearchParams(searchParams);
  const [result, countsByStatus] = await Promise.all([
    listSellerOrders(context.seller.id, params),
    countSellerOrdersByStatus(context.seller.id),
  ]);
  const queue = resolveSellerOrderQueue(params.queue, params.status);
  const queueCounts = {
    TO_PREPARE: countSellerOrdersInQueue("TO_PREPARE", countsByStatus),
    AWAITING_PAYMENT: countSellerOrdersInQueue("AWAITING_PAYMENT", countsByStatus),
  };
  const hasFilters = Boolean(
    params.q || params.from || params.to || params.status !== "ALL" || params.shipmentStatus !== "ALL",
  );

  const pageHref = (page: number) => serializeSellerOrdersSearchParams(basePath, { ...params, page }) as Route;
  // Trocar de aba limpa o status escolhido no filtro, que de outro modo anularia a aba.
  const queueHref = (nextQueue: SellerOrderQueue) =>
    serializeSellerOrdersSearchParams(basePath, { ...params, queue: nextQueue, status: "ALL", page: 1 }) as Route;

  return (
    <>
      <PageHeader
        eyebrow="Pedidos"
        title="Preparação e envio"
        description="Compre etiquetas, gere documentos e acompanhe o rastreamento dos pedidos da sua loja."
      />

      <Card>
        <CardHeader>
          <CardTitle>Pedidos da loja</CardTitle>
          <CardDescription>
            {result.total} {result.total === 1 ? "pedido encontrado" : "pedidos encontrados"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SellerOrderQueueTabs current={queue} counts={queueCounts} hrefFor={queueHref} />
          <Disclosure variant="section" summary="Filtros de pedidos" defaultOpen={hasFilters} className="mb-5">
            <FilterForm resetHref={basePath} action={basePath} label="Filtrar pedidos">
              <input type="hidden" name="queue" value={params.queue} />
              <FilterText label="Buscar pedido" name="q" value={params.q} placeholder="Número, cliente ou e-mail" />
              <FilterSelect label="Status" name="status" value={params.status} options={orderStatusFilterOptions} />
              <FilterSelect
                label="Status do envio"
                name="shipmentStatus"
                value={params.shipmentStatus}
                options={shipmentStatusFilterOptions}
              />
              <FilterSelect label="Ordenação" name="sort" value={params.sort} options={sortOptions} />
              <FilterDateRange fromName="from" toName="to" from={params.from} to={params.to} />
            </FilterForm>
          </Disclosure>

          {result.orders.length === 0 ? (
            <EmptyState
              variant="inline"
              icon={domainIcons.order}
              title={hasFilters ? "Nenhum pedido corresponde aos filtros selecionados." : emptyQueueTitles[queue]}
              description={
                hasFilters
                  ? "Ajuste ou limpe os filtros para ver outros pedidos."
                  : "Novos pedidos pagos aparecem em A preparar."
              }
              action={hasFilters ? { label: "Limpar filtros", href: basePath } : undefined}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {result.orders.map((order) => {
                const shipment = order.shipment;
                return (
                  <article key={order.id} className="border-border flex flex-col gap-4 rounded-lg border p-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{order.order.orderNumber}</h3>
                          <StatusBadge domain="sellerOrder" status={order.status} />
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {order.order.customerName} · {formatMoneyInCents(order.customerShippingAmountInCents)} em
                          frete
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Criado em <time dateTime={order.createdAt.toISOString()}>{formatDate(order.createdAt)}</time>{" "}
                          · {order.items.length} {order.items.length === 1 ? "item" : "itens"}
                        </p>
                      </div>
                      {shipment ? (
                        <StatusBadge
                          domain={shipment.provider === "OWN" ? "ownShipment" : "shipment"}
                          status={shipment.status}
                        />
                      ) : null}
                    </div>

                    <div className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-2">
                      <p>
                        Serviço: {shipment?.carrier ?? "-"} · {shipment?.service ?? "-"}
                      </p>
                      <p>Rastreio: {shipment?.trackingCode ?? "Ainda não disponível"}</p>
                      {shipment?.trackingUrl ? (
                        <a
                          className="text-brand-strong underline"
                          href={shipment.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir rastreamento
                        </a>
                      ) : null}
                    </div>

                    <SellerOrderAfterSales order={order} />
                    <SellerOrderDelivery order={order} />
                    {hasSellerPermission(context.membership.role, "ORDER_UPDATE") &&
                      (shipment?.provider === "OWN" ? (
                        <OwnShipmentActions
                          sellerOrderId={order.id}
                          canShip={canAdvanceOwnShipment(order.status, shipment.status, "SHIPPED")}
                          canDeliver={canAdvanceOwnShipment(order.status, shipment.status, "DELIVERED")}
                        />
                      ) : (
                        <ShipmentActions
                          sellerOrderId={order.id}
                          canPurchase={order.status === "PAID" || order.status === "PROCESSING"}
                          hasShipment={Boolean(shipment?.externalShipmentId)}
                          hasTrackingCode={Boolean(shipment?.trackingCode)}
                          generationState={shipment?.generationState ?? null}
                        />
                      ))}
                  </article>
                );
              })}
            </div>
          )}

          {result.pageCount > 1 ? (
            <Pagination
              ariaLabel="Paginação de pedidos da loja"
              page={result.page}
              pageCount={result.pageCount}
              previousHref={pageHref(result.page - 1)}
              nextHref={pageHref(result.page + 1)}
              className="mt-6"
            />
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
