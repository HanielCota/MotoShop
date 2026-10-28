import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { DesignSelect } from "@/components/ui/design-select";
import { DateFilterInput } from "@/components/ui/date-filter-input";
import type { Metadata, Route } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { isInvertedDateRange } from "@/lib/date-filter";
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
import { CustomerAccountShell } from "@/modules/customers/components/customer-account-shell";
import { domainIcons } from "@/shared/presentation/domain-icons";
import { CustomerOrderCard, firstOrderItem } from "@/modules/orders/components/customer-order-card";
import { getOrderItemThumbnails } from "@/modules/orders/queries/order-item-thumbnails";
import type { CartThumbnail } from "@/modules/cart/queries/cart-thumbnails";

export const metadata: Metadata = {
  title: "Meus pedidos",
  robots: { index: false, follow: false },
};

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
  const hasInvertedPeriod = isInvertedDateRange(params.orderFrom, params.orderTo);
  // Each card shows its first item, so only those need a photo.
  const thumbnails = await getOrderItemThumbnails(
    result.orders.flatMap((order) => {
      const item = firstOrderItem(order);
      return item == null ? [] : [item];
    }),
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
    <CustomerAccountShell pathname="/orders" userName={session.user.name}>
      <PageHeader
        eyebrow="Minha conta"
        title="Meus pedidos"
        description="Acompanhe o pagamento e a entrega de cada compra."
      />

      {/* No order yet and no filter: only the empty state, without a count or filters for nothing. */}
      {allOrders.total > 0 || hasFilters ? (
        <>
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
              <Button type="submit">Filtrar</Button>
            </form>
          </details>
        </>
      ) : null}
      {result.orders.length === 0 ? (
        hasInvertedPeriod ? (
          <EmptyState
            icon={domainIcons.notFound}
            title="Período invertido"
            description="A data inicial está depois da data final. Ajuste o período e filtre de novo."
            action={{ label: "Limpar filtros", href: "/orders" }}
          />
        ) : hasFilters && allOrders.total > 0 ? (
          <EmptyState
            icon={domainIcons.notFound}
            title="Nenhum pedido encontrado"
            description="Nenhum pedido corresponde aos filtros selecionados."
            action={{ label: "Limpar filtros", href: "/orders" }}
          />
        ) : (
          <EmptyState
            icon={domainIcons.order}
            title="Você ainda não fez nenhum pedido"
            description="Quando comprar, você acompanha pagamento e entregas por aqui."
            action={{ label: "Explorar produtos", href: "/products" }}
          />
        )
      ) : (
        <div className="space-y-4">
          {result.orders.map((order) => (
            <CustomerOrderCard
              key={order.orderNumber}
              order={order}
              thumbnailUrl={firstItemThumbnailUrl(order, thumbnails)}
            />
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
    </CustomerAccountShell>
  );
}

function firstItemThumbnailUrl(
  order: Parameters<typeof firstOrderItem>[0],
  thumbnails: ReadonlyMap<string, CartThumbnail>,
): string | undefined {
  const item = firstOrderItem(order);
  if (item == null) return undefined;

  return thumbnails.get(item.id)?.url;
}
