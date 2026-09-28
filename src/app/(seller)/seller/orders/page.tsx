import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { DesignSelect } from "@/components/ui/design-select";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyInCents } from "@/lib/utils";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { ShipmentActions } from "@/modules/shipping/components/shipment-actions";
import { OwnShipmentActions } from "@/modules/shipping/components/own-shipping-forms";
import { hasSellerPermission } from "@/modules/auth/domain/seller-permissions";
import { canAdvanceOwnShipment } from "@/modules/shipping/domain/own-shipping";
import { listSellerOrders } from "@/modules/shipping/queries/seller-orders";
import { loadSellerOrdersSearchParams } from "@/modules/shipping/search-params";

const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  PROCESSING: "Em processamento",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLATION_REQUESTED: "Cancelamento em análise",
  CANCELLED: "Cancelado",
};

const shipmentStatusLabels: Record<string, string> = {
  PENDING: "Pendente",
  READY_TO_SHIP: "Pronto para envio",
  SHIPPED: "Postado",
  IN_TRANSIT: "Em trânsito",
  DELIVERED: "Entregue",
  EXCEPTION: "Exceção",
  CANCELLED: "Cancelado",
};

export default async function SellerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireSellerAccess("ORDER_READ");
  const params = await loadSellerOrdersSearchParams(searchParams);
  const result = await listSellerOrders(context.seller.id, params);

  function pageHref(page: number): Route {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    if (params.status !== "ALL") query.set("status", params.status);
    if (params.shipmentStatus !== "ALL") query.set("shipmentStatus", params.shipmentStatus);
    if (params.sort !== "newest") query.set("sort", params.sort);
    if (page > 1) query.set("page", String(page));
    const serialized = query.toString();
    return (serialized ? `/seller/orders?${serialized}` : "/seller/orders") as Route;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="secondary">Pedidos</Badge>
        <h2 className="mt-2 text-2xl font-semibold">Fulfillment e envios</h2>
        <p className="text-muted-foreground text-sm">
          Compre etiquetas, gere documentos e acompanhe o rastreamento dos pedidos da sua loja.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos da loja</CardTitle>
          <CardDescription>{result.total} {result.total === 1 ? "pedido encontrado" : "pedidos encontrados"}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="mb-5 grid gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-6" method="get">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Buscar pedido
              <Input name="q" defaultValue={params.q ?? ""} placeholder="Número, cliente ou e-mail" />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Status
              <DesignSelect aria-label="Status" name="status" defaultValue={params.status}>
                <option value="ALL">Todos</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Status do envio
              <DesignSelect aria-label="Status do envio" name="shipmentStatus" defaultValue={params.shipmentStatus}>
                <option value="ALL">Todos</option>
                {Object.entries(shipmentStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Ordenação
              <DesignSelect aria-label="Ordenação" name="sort" defaultValue={params.sort}>
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              De
              <Input name="from" type="date" defaultValue={params.from ?? ""} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Até
              <Input name="to" type="date" defaultValue={params.to ?? ""} />
            </label>
            <Button type="submit" className="rounded-md px-4">
              Filtrar
            </Button>
          </form>

          {result.orders.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ainda não há pedidos para processar.</p>
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
                          <Badge variant="outline">{statusLabels[order.status] ?? order.status}</Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {order.order.customerName} · {formatMoneyInCents(order.customerShippingAmountInCents)} em
                          frete
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Criado em {new Intl.DateTimeFormat("pt-BR").format(order.createdAt)} · {order.items.length}{" "}
                          item(ns)
                        </p>
                      </div>
                      {shipment ? (
                        <Badge variant={shipment.status === "EXCEPTION" ? "destructive" : "secondary"}>
                          {shipmentStatusLabels[shipment.status] ?? shipment.status}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-2">
                      <p>
                        Serviço: {shipment?.carrier ?? "-"} · {shipment?.service ?? "-"}
                      </p>
                      <p>Rastreio: {shipment?.trackingCode ?? "Ainda não disponível"}</p>
                      {shipment?.trackingUrl ? (
                        <a
                          className="text-primary underline"
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
                        />
                      ))}
                  </article>
                );
              })}
            </div>
          )}

          {result.pageCount > 1 ? (
            <Pagination
              ariaLabel="Paginação de pedidos do seller"
              page={result.page}
              pageCount={result.pageCount}
              previousHref={pageHref(result.page - 1)}
              nextHref={pageHref(result.page + 1)}
              className="mt-6"
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
