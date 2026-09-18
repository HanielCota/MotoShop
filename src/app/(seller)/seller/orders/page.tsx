import Link from "next/link";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyInCents } from "@/lib/utils";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { ShipmentActions } from "@/modules/shipping/components/shipment-actions";
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
          <CardDescription>{result.total} pedido(s) encontrados.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 sm:items-end" method="get">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Buscar pedido
              <input
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Número, cliente ou e-mail"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Status
              <select
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                name="status"
                defaultValue={params.status}
              >
                <option value="ALL">Todos</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Status do envio
              <select
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                name="shipmentStatus"
                defaultValue={params.shipmentStatus}
              >
                <option value="ALL">Todos</option>
                {Object.entries(shipmentStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Ordenação
              <select className="border-input bg-background h-10 rounded-md border px-3 text-sm" name="sort" defaultValue={params.sort}>
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              De
              <input className="border-input bg-background h-10 rounded-md border px-3 text-sm" name="from" type="date" defaultValue={params.from ?? ""} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Até
              <input className="border-input bg-background h-10 rounded-md border px-3 text-sm" name="to" type="date" defaultValue={params.to ?? ""} />
            </label>
            <button className="bg-primary text-primary-foreground h-10 rounded-md px-4 text-sm font-medium">
              Filtrar
            </button>
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

                    <ShipmentActions
                      sellerOrderId={order.id}
                      canPurchase={order.status === "PAID" || order.status === "PROCESSING"}
                      hasShipment={Boolean(shipment?.externalShipmentId)}
                      hasTrackingCode={Boolean(shipment?.trackingCode)}
                    />
                  </article>
                );
              })}
            </div>
          )}

          {result.pageCount > 1 ? (
            <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Paginação de pedidos do seller">
              {result.page > 1 ? (
                <Link href={pageHref(result.page - 1)} className="rounded-md border px-3 py-2 text-sm">
                  Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground text-sm">
                Página {result.page} de {result.pageCount}
              </span>
              {result.page < result.pageCount ? (
                <Link href={pageHref(result.page + 1)} className="rounded-md border px-3 py-2 text-sm">
                  Próxima
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
