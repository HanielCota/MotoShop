import { FilterDateRange, FilterForm, FilterSelect, FilterText } from "@/components/ui/filter-form";
import { Pagination } from "@/components/ui/pagination";
import type { Metadata, Route } from "next";
import { createSerializer } from "nuqs/server";
import { ClipboardList } from "lucide-react";

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
import { canAdvanceOwnShipment } from "@/modules/shipping/domain/own-shipping";
import { listSellerOrders } from "@/modules/shipping/queries/seller-orders";
import {
  loadSellerOrdersSearchParams,
  sellerOrderStatusValues,
  sellerOrdersSearchParams,
  shipmentStatusValues,
} from "@/modules/shipping/search-params";

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
  const result = await listSellerOrders(context.seller.id, params);
  const hasFilters = Boolean(
    params.q || params.from || params.to || params.status !== "ALL" || params.shipmentStatus !== "ALL",
  );

  const pageHref = (page: number) => serializeSellerOrdersSearchParams(basePath, { ...params, page }) as Route;

  return (
    <>
      <PageHeader
        eyebrow="Pedidos"
        title="Preparação e envio"
        description="Compre etiquetas, gere documentos e acompanhe o rastreamento dos pedidos da sua loja."
      />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg">Pedidos da loja</h2>
          </CardTitle>
          <CardDescription>
            {result.total} {result.total === 1 ? "pedido encontrado" : "pedidos encontrados"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <details className="mb-5" open={hasFilters}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold [&::-webkit-details-marker]:hidden">
              Filtros de pedidos
            </summary>
            <FilterForm resetHref={basePath} action={basePath} label="Filtrar pedidos">
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
          </details>

          {result.orders.length === 0 ? (
            <EmptyState
              variant="inline"
              icon={ClipboardList}
              title={
                hasFilters
                  ? "Nenhum pedido corresponde aos filtros selecionados."
                  : "Ainda não há pedidos para processar."
              }
              description={
                hasFilters
                  ? "Ajuste ou limpe os filtros para ver outros pedidos."
                  : "Novos pedidos pagos aparecerão aqui."
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
                      {shipment ? <StatusBadge domain="shipment" status={shipment.status} /> : null}
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

                    {shipment?.provider === "OWN" && order.order.shippingAddress ? (
                      <section
                        className="bg-muted grid gap-2 rounded-md p-3 text-sm"
                        aria-label="Dados da entrega própria"
                      >
                        <h4 className="font-semibold">Preparar entrega</h4>
                        <ul className="list-inside list-disc">
                          {order.items.map((item) => (
                            <li key={item.id}>
                              {item.quantity} × {item.productNameSnapshot} · {item.variantDescriptionSnapshot} · SKU{" "}
                              {item.skuSnapshot}
                            </li>
                          ))}
                        </ul>
                        <address className="break-words not-italic">
                          {order.order.shippingAddress.recipient}
                          <br />
                          {order.order.shippingAddress.street}, {order.order.shippingAddress.number}
                          {order.order.shippingAddress.complement ? ` · ${order.order.shippingAddress.complement}` : ""}
                          <br />
                          {order.order.shippingAddress.neighborhood} · {order.order.shippingAddress.city}/
                          {order.order.shippingAddress.state}
                          <br />
                          CEP {order.order.shippingAddress.postalCode} · Telefone {order.order.customerPhone}
                        </address>
                      </section>
                    ) : null}
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
