import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { DesignSelect } from "@/components/ui/design-select";
import { DateFilterInput } from "@/components/ui/date-filter-input";
import Link from "next/link";
import type { Route } from "next";

import { PackageSearch, ShoppingBag } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatMoneyInCents } from "@/lib/format";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { listCustomerOrders } from "@/modules/orders/queries/customer-orders";
import {
  customerOrderStatusValues,
  customerPaymentStatusValues,
  customerShipmentStatusValues,
  loadCustomerOrderSearchParams,
} from "@/modules/orders/search-params";
import { getStatusLabel, type StatusDomain } from "@/shared/presentation/status-labels";
import { parseMoneyFilterToCents } from "@/modules/orders/domain/money-filter";
import { CustomerAccountNavigation } from "@/modules/customers/components/customer-account-navigation";

function statusOptions(domain: StatusDomain, values: readonly string[]) {
  return values.filter((value) => value !== "ALL").map((value) => ({ value, label: getStatusLabel(domain, value) }));
}

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
    minTotalInCents: parseMoneyFilterToCents(params.orderMinTotal),
    maxTotalInCents: parseMoneyFilterToCents(params.orderMaxTotal),
    orderSort: params.orderSort,
    page: params.orderPage,
  });
  const hasFilters = Boolean(
    params.orderStatus !== "ALL" ||
    params.orderQ?.trim() ||
    params.storeQ?.trim() ||
    params.shipmentStatus !== "ALL" ||
    params.paymentStatus !== "ALL" ||
    params.orderFrom ||
    params.orderTo ||
    params.orderMinTotal ||
    params.orderMaxTotal,
  );
  const allOrders = hasFilters ? await listCustomerOrders(session.user.id, { pageSize: 1 }) : result;

  function pageHref(page: number): Route {
    const query = new URLSearchParams();
    if (params.orderStatus !== "ALL") query.set("orderStatus", params.orderStatus);
    if (params.orderQ) query.set("orderQ", params.orderQ);
    if (params.storeQ) query.set("storeQ", params.storeQ);
    if (params.shipmentStatus !== "ALL") query.set("shipmentStatus", params.shipmentStatus);
    if (params.paymentStatus !== "ALL") query.set("paymentStatus", params.paymentStatus);
    if (params.orderFrom) query.set("orderFrom", params.orderFrom);
    if (params.orderTo) query.set("orderTo", params.orderTo);
    if (params.orderMinTotal) query.set("orderMinTotal", params.orderMinTotal);
    if (params.orderMaxTotal) query.set("orderMaxTotal", params.orderMaxTotal);
    if (params.orderSort !== "newest") query.set("orderSort", params.orderSort);
    if (page > 1) query.set("orderPage", String(page));
    const serialized = query.toString();
    return (serialized ? `/orders?${serialized}` : "/orders") as Route;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <CustomerAccountNavigation pathname="/orders" />
        <div className="flex min-w-0 flex-col gap-8">
          <PageHeader
            eyebrow="Minha conta"
            title="Meus pedidos"
            description="Acompanhe compras, lojas e envios em um só lugar."
          />

          <p className="text-muted-foreground text-sm" aria-live="polite">
            {result.total} {result.total === 1 ? "pedido encontrado" : "pedidos encontrados"}
          </p>
          <details className="border-border bg-card rounded-xl border p-4" open={hasFilters}>
            <summary className="cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">
              Filtros avançados{" "}
              <span className="text-muted-foreground text-sm font-normal">(status, loja, valor e período)</span>
            </summary>
            <form className="mt-4 grid gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-4" method="get">
              <label className="flex min-w-0 flex-col gap-2 text-sm font-medium sm:col-span-2 lg:col-span-2">
                Buscar pedido
                <Input name="orderQ" defaultValue={params.orderQ ?? ""} placeholder="Número, produto ou SKU" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Valor mínimo (R$)
                <Input
                  name="orderMinTotal"
                  type="text"
                  inputMode="decimal"
                  defaultValue={params.orderMinTotal ?? ""}
                  placeholder="Ex.: 50,00"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Valor máximo (R$)
                <Input
                  name="orderMaxTotal"
                  type="text"
                  inputMode="decimal"
                  defaultValue={params.orderMaxTotal ?? ""}
                  placeholder="Ex.: 1000,00"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Envio
                <DesignSelect aria-label="Envio" name="shipmentStatus" defaultValue={params.shipmentStatus}>
                  <option value="ALL">Todos</option>
                  {statusOptions("shipment", customerShipmentStatusValues).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </DesignSelect>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Buscar loja
                <Input name="storeQ" defaultValue={params.storeQ ?? ""} placeholder="Nome da loja" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Filtrar por status
                <DesignSelect aria-label="Filtrar por status" name="orderStatus" defaultValue={params.orderStatus}>
                  <option value="ALL">Todos os pedidos</option>
                  {statusOptions("order", customerOrderStatusValues).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </DesignSelect>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Pagamento
                <DesignSelect aria-label="Pagamento" name="paymentStatus" defaultValue={params.paymentStatus}>
                  <option value="ALL">Todos</option>
                  {statusOptions("payment", customerPaymentStatusValues).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </DesignSelect>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                De
                <DateFilterInput name="orderFrom" value={params.orderFrom} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Até
                <DateFilterInput name="orderTo" value={params.orderTo} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Ordenação
                <DesignSelect aria-label="Ordenação" name="orderSort" defaultValue={params.orderSort}>
                  <option value="newest">Mais recentes</option>
                  <option value="oldest">Mais antigos</option>
                  <option value="total_high">Maior valor</option>
                  <option value="total_low">Menor valor</option>
                </DesignSelect>
              </label>
              <Button type="submit" className="rounded-md px-4">
                Filtrar
              </Button>
            </form>
          </details>
          {result.orders.length === 0 ? (
            hasFilters && allOrders.total > 0 ? (
              <EmptyState
                icon={PackageSearch}
                title="Nenhum pedido encontrado"
                description="Nenhum pedido corresponde aos filtros selecionados."
                action={{ label: "Limpar filtros", href: "/orders" }}
              />
            ) : (
              <EmptyState
                icon={ShoppingBag}
                title="Você ainda não fez nenhum pedido"
                description="Quando comprar, você acompanha pagamento e entregas por aqui."
                action={{ label: "Explorar produtos", href: "/products" }}
              />
            )
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
                          {formatDate(order.createdAt)} · {order.sellerOrders.length}{" "}
                          {order.sellerOrders.length === 1 ? "loja" : "lojas"}
                        </CardDescription>
                      </div>
                      <StatusBadge domain="order" status={order.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-foreground font-semibold">
                        {formatMoneyInCents(order.totalAmountInCents)}
                      </span>
                      {order.payments[0] ? (
                        <StatusBadge
                          domain="payment"
                          status={order.payments[0].status}
                          label={`Pagamento: ${getStatusLabel("payment", order.payments[0].status)}`}
                        />
                      ) : null}
                      <Link
                        className="text-brand-strong text-sm font-medium underline underline-offset-4"
                        href={`/orders/${order.orderNumber}` as Route}
                      >
                        Ver detalhes
                      </Link>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {order.sellerOrders.map((sellerOrder) => (
                        <div key={sellerOrder.id} className="bg-surface-sunken rounded-md p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-foreground font-medium">{sellerOrder.storeNameSnapshot}</span>
                            <StatusBadge domain="sellerOrder" status={sellerOrder.status} />
                          </div>
                          <p className="text-muted-foreground mt-1">
                            {sellerOrder.items.length} {sellerOrder.items.length === 1 ? "item" : "itens"}
                            {sellerOrder.shipment
                              ? ` · ${getStatusLabel("shipment", sellerOrder.shipment.status)}`
                              : ""}
                          </p>
                          {sellerOrder.shipment?.trackingUrl ? (
                            <a
                              className="text-brand-strong mt-2 inline-block text-xs underline"
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
            <Pagination
              ariaLabel="Paginação de pedidos"
              page={result.page}
              pageCount={result.pageCount}
              previousHref={pageHref(result.page - 1)}
              nextHref={pageHref(result.page + 1)}
              summary={
                <>
                  {result.total} {result.total === 1 ? "pedido" : "pedidos"}
                </>
              }
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
