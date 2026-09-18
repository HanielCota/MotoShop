import Link from "next/link";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyInCents } from "@/lib/utils";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { listCustomerOrders } from "@/modules/orders/queries/customer-orders";
import { loadCustomerOrderSearchParams } from "@/modules/orders/search-params";

const orderStatusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  PROCESSING: "Em processamento",
  PARTIALLY_SHIPPED: "Parcialmente enviado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  PARTIALLY_CANCELLED: "Parcialmente cancelado",
  CANCELLED: "Cancelado",
  CANCELLATION_REQUESTED: "Cancelamento em análise",
};

const shipmentStatusLabels: Record<string, string> = {
  PENDING: "Aguardando envio",
  READY_TO_SHIP: "Etiqueta pronta",
  SHIPPED: "Postado",
  IN_TRANSIT: "Em trânsito",
  DELIVERED: "Entregue",
  EXCEPTION: "Problema no envio",
  CANCELLED: "Envio cancelado",
};

const paymentStatusLabels: Record<string, string> = {
  PENDING: "Pagamento pendente",
  PROCESSING: "Pagamento processando",
  AUTHORIZED: "Pagamento autorizado",
  APPROVED: "Pagamento aprovado",
  FAILED: "Pagamento recusado",
  CANCELLED: "Pagamento cancelado",
  PARTIALLY_REFUNDED: "Pagamento parcialmente reembolsado",
  REFUNDED: "Pagamento reembolsado",
};

export default async function CustomerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuthenticatedUser("/orders");
  const params = await loadCustomerOrderSearchParams(searchParams);
  const result = await listCustomerOrders(session.user.id, {
    status: params.orderStatus,
    q: params.orderQ,
    storeQ: params.storeQ,
    shipmentStatus: params.shipmentStatus,
    paymentStatus: params.paymentStatus,
    from: params.orderFrom,
    to: params.orderTo,
    minTotalInCents: params.orderMinTotal,
    maxTotalInCents: params.orderMaxTotal,
    orderSort: params.orderSort,
    page: params.orderPage,
  });

  function pageHref(page: number): Route {
    const query = new URLSearchParams();
    if (params.orderStatus !== "ALL") query.set("orderStatus", params.orderStatus);
    if (params.orderQ) query.set("orderQ", params.orderQ);
    if (params.storeQ) query.set("storeQ", params.storeQ);
    if (params.shipmentStatus !== "ALL") query.set("shipmentStatus", params.shipmentStatus);
    if (params.paymentStatus !== "ALL") query.set("paymentStatus", params.paymentStatus);
    if (params.orderFrom) query.set("orderFrom", params.orderFrom);
    if (params.orderTo) query.set("orderTo", params.orderTo);
    if (params.orderMinTotal !== null && params.orderMinTotal !== undefined) query.set("orderMinTotal", String(params.orderMinTotal));
    if (params.orderMaxTotal !== null && params.orderMaxTotal !== undefined) query.set("orderMaxTotal", String(params.orderMaxTotal));
    if (params.orderSort !== "newest") query.set("orderSort", params.orderSort);
    if (page > 1) query.set("orderPage", String(page));
    const serialized = query.toString();
    return (serialized ? `/orders?${serialized}` : "/orders") as Route;
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div>
        <Badge variant="secondary">Minha conta</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Meus pedidos</h1>
        <p className="text-muted-foreground mt-3">Acompanhe compras, lojas e envios em um só lugar.</p>
      </div>

      <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-9 sm:items-end" method="get">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Buscar pedido
          <input
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            name="orderQ"
            defaultValue={params.orderQ ?? ""}
            placeholder="Número, produto ou SKU"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Total mín. (centavos)
          <input className="border-input bg-background h-10 rounded-md border px-3 text-sm" name="orderMinTotal" type="number" min="0" defaultValue={params.orderMinTotal ?? ""} placeholder="Ex.: 5000" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Total máx. (centavos)
          <input className="border-input bg-background h-10 rounded-md border px-3 text-sm" name="orderMaxTotal" type="number" min="0" defaultValue={params.orderMaxTotal ?? ""} placeholder="Ex.: 100000" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Envio
          <select
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            name="shipmentStatus"
            defaultValue={params.shipmentStatus}
          >
            <option value="ALL">Todos</option>
            <option value="PENDING">Aguardando envio</option>
            <option value="READY_TO_SHIP">Etiqueta pronta</option>
            <option value="SHIPPED">Postado</option>
            <option value="IN_TRANSIT">Em trânsito</option>
            <option value="DELIVERED">Entregue</option>
            <option value="EXCEPTION">Problema no envio</option>
            <option value="CANCELLED">Envio cancelado</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Buscar loja
          <input
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            name="storeQ"
            defaultValue={params.storeQ ?? ""}
            placeholder="Nome da loja"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Filtrar por status
          <select
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            name="orderStatus"
            defaultValue={params.orderStatus}
          >
            <option value="ALL">Todos os pedidos</option>
            <option value="PENDING_PAYMENT">Aguardando pagamento</option>
            <option value="PAID">Pagos</option>
            <option value="PROCESSING">Em processamento</option>
            <option value="PARTIALLY_SHIPPED">Parcialmente enviados</option>
            <option value="SHIPPED">Enviados</option>
            <option value="DELIVERED">Entregues</option>
            <option value="PARTIALLY_CANCELLED">Parcialmente cancelados</option>
            <option value="CANCELLED">Cancelados</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Pagamento
          <select
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            name="paymentStatus"
            defaultValue={params.paymentStatus}
          >
            <option value="ALL">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="PROCESSING">Processando</option>
            <option value="AUTHORIZED">Autorizado</option>
            <option value="APPROVED">Aprovado</option>
            <option value="FAILED">Recusado</option>
            <option value="CANCELLED">Cancelado</option>
            <option value="PARTIALLY_REFUNDED">Parcialmente reembolsado</option>
            <option value="REFUNDED">Reembolsado</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          De
          <input
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            name="orderFrom"
            type="date"
            defaultValue={params.orderFrom ?? ""}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Até
          <input
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            name="orderTo"
            type="date"
            defaultValue={params.orderTo ?? ""}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Ordenação
          <select
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            name="orderSort"
            defaultValue={params.orderSort}
          >
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="total_high">Maior valor</option>
            <option value="total_low">Menor valor</option>
          </select>
        </label>
        <button className="bg-primary text-primary-foreground h-10 rounded-md px-4 text-sm font-medium">Filtrar</button>
      </form>
      {result.orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-muted-foreground">Você ainda não fez nenhum pedido.</p>
            <Link href="/products" className="text-primary font-medium underline underline-offset-4">
              Explorar produtos
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {result.orders.map((order) => (
            <Card key={order.orderNumber}>
              <CardHeader>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <CardTitle>
                      <Link className="hover:underline" href={`/orders/${order.orderNumber}` as Route}>
                        {order.orderNumber}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {new Intl.DateTimeFormat("pt-BR").format(order.createdAt)} · {order.sellerOrders.length} loja(s)
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{orderStatusLabels[order.status] ?? order.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-semibold">{formatMoneyInCents(order.totalAmountInCents)}</span>
                    {order.payments[0] ? (
                      <Badge variant={order.payments[0].status === "FAILED" ? "destructive" : "secondary"}>
                        {paymentStatusLabels[order.payments[0].status] ?? order.payments[0].status}
                      </Badge>
                    ) : null}
                    <Link
                    className="text-primary text-sm font-medium underline underline-offset-4"
                    href={`/orders/${order.orderNumber}` as Route}
                  >
                    Ver detalhes
                  </Link>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {order.sellerOrders.map((sellerOrder) => (
                    <div key={sellerOrder.id} className="bg-muted/40 rounded-md p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{sellerOrder.storeNameSnapshot}</span>
                        <Badge variant="secondary">{orderStatusLabels[sellerOrder.status] ?? sellerOrder.status}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-1">
                        {sellerOrder.items.length} item(ns)
                        {sellerOrder.shipment ? ` · ${shipmentStatusLabels[sellerOrder.shipment.status]}` : ""}
                      </p>
                      {sellerOrder.shipment?.trackingUrl ? (
                        <a
                          className="text-primary mt-2 inline-block text-xs underline"
                          href={sellerOrder.shipment.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Acompanhar entrega
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {result.pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Paginação de pedidos">
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1)} className="rounded-md border px-3 py-2 text-sm">
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground text-sm">
            Página {result.page} de {result.pageCount} · {result.total} pedido(s)
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
    </main>
  );
}
