import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatCount } from "@/lib/format";
import { listSellerOptionsForAdmin } from "@/modules/sellers/queries/sellers";
import { getStatusLabel, getStatusOptions } from "@/shared/presentation/status-labels";

import { adminHref, adminOrderHref } from "../../admin-href";
import { listSellerOrdersForAdmin } from "../../queries/orders";
import { adminOrderStatusValues, loadAdminOrderSearchParams } from "../../search-params";
import {
  AdminCard,
  AdminFilterForm,
  AdminList,
  AdminTable,
  cellClassName,
  FilterDateRange,
  FilterSelect,
  FilterText,
  newestFirstSortOptions,
  sellerFilterOptions,
} from "../admin-ui";
import type { AdminSectionProps } from "./types";
import { domainIcons } from "@/shared/presentation/domain-icons";

const orderStatusOptions = [
  { value: "ALL", label: "Todos" },
  ...adminOrderStatusValues
    .filter((status) => status !== "ALL")
    .map((status) => ({ value: status, label: getStatusLabel("sellerOrder", status) })),
];

const shipmentStatusOptions = [{ value: "ALL", label: "Todos" }, ...getStatusOptions("shipment")];

export async function AdminOrdersSection({ searchParams }: AdminSectionProps) {
  const params = await loadAdminOrderSearchParams(searchParams);
  const [result, sellerOptions] = await Promise.all([
    listSellerOrdersForAdmin({
      status: params.adminOrderStatus,
      shipmentStatus: params.adminOrderShipmentStatus,
      q: params.adminOrderQ,
      sellerId: params.adminOrderSellerId,
      from: params.adminOrderFrom,
      to: params.adminOrderTo,
      sort: params.adminOrderSort,
      page: params.adminOrderPage,
    }),
    listSellerOptionsForAdmin(),
  ]);
  const pageHref = (page: number) =>
    adminHref("orders", { ...params, adminOrderPage: page }, { adminOrderSort: "newest" });

  return (
    <AdminCard
      id="admin-orders"
      title="Pedidos em operação"
      description="Visão consolidada dos pedidos por lojista para acompanhamento administrativo."
    >
      <AdminFilterForm resetHref={adminHref("orders", {})} label="Filtrar pedidos">
        <FilterText
          label="Buscar pedido"
          name="adminOrderQ"
          value={params.adminOrderQ}
          placeholder="Número, cliente ou loja"
        />
        <FilterSelect
          label="Status do pedido"
          name="adminOrderStatus"
          value={params.adminOrderStatus}
          options={orderStatusOptions}
        />
        <FilterSelect
          label="Status do envio"
          name="adminOrderShipmentStatus"
          value={params.adminOrderShipmentStatus}
          options={shipmentStatusOptions}
        />
        <FilterSelect
          label="Lojista"
          name="adminOrderSellerId"
          value={params.adminOrderSellerId ?? ""}
          options={sellerFilterOptions(sellerOptions)}
        />
        <FilterDateRange
          fromName="adminOrderFrom"
          toName="adminOrderTo"
          from={params.adminOrderFrom}
          to={params.adminOrderTo}
        />
        <FilterSelect
          label="Ordenação"
          name="adminOrderSort"
          value={params.adminOrderSort}
          options={newestFirstSortOptions}
        />
      </AdminFilterForm>
      {result.orders.length === 0 ? (
        <EmptyState
          icon={domainIcons.notFound}
          title="Nenhum pedido encontrado"
          description="Ajuste os filtros para ver outros pedidos."
        />
      ) : (
        <>
          {/* No celular, cartões em vez da tabela que cortava loja e cliente (BUG-024). */}
          <div className="md:hidden">
            <AdminList label="Pedidos em operação">
              {result.orders.map((order) => (
                <li key={order.id} className="flex flex-col gap-1 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={adminOrderHref(order.order.orderNumber)}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {order.order.orderNumber}
                    </Link>
                    <StatusBadge domain="sellerOrder" status={order.status} />
                  </div>
                  <p>{order.storeNameSnapshot}</p>
                  <p className="text-muted-foreground break-all">
                    {order.order.customerName} · {order.order.customerEmail}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatCount(order._count.items, "item", "itens")} · {formatDate(order.createdAt)}
                    {order.shipment ? ` · ${order.shipment.trackingCode ?? "sem rastreio"}` : " · sem envio"}
                  </p>
                  {order.shipment ? <StatusBadge domain="shipment" status={order.shipment.status} /> : null}
                </li>
              ))}
            </AdminList>
          </div>
          <AdminTable
            caption="Pedidos em operação"
            columns={["Pedido", "Loja e cliente", "Status", "Envio", "Criado em"]}
            minWidth="min-w-[820px]"
            className="hidden md:block"
          >
            {" "}
            {result.orders.map((order) => (
              <tr key={order.id}>
                <td className={`${cellClassName} font-medium whitespace-nowrap`}>
                  <Link href={adminOrderHref(order.order.orderNumber)} className="underline-offset-4 hover:underline">
                    {order.order.orderNumber}
                  </Link>
                  <p className="text-muted-foreground text-xs font-normal">
                    {formatCount(order._count.items, "item", "itens")}
                  </p>
                </td>
                <td className={cellClassName}>
                  <p>{order.storeNameSnapshot}</p>
                  <p className="text-muted-foreground text-xs break-all">
                    {order.order.customerName} · {order.order.customerEmail}
                  </p>
                </td>
                <td className={cellClassName}>
                  <StatusBadge domain="sellerOrder" status={order.status} />
                </td>
                <td className={cellClassName}>
                  {order.shipment ? (
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge domain="shipment" status={order.shipment.status} />
                      <span className="text-muted-foreground text-xs">
                        {order.shipment.trackingCode ?? "Sem rastreio"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">Sem envio</span>
                  )}
                </td>
                <td className={`${cellClassName} text-muted-foreground whitespace-nowrap`}>
                  {formatDate(order.createdAt)}
                </td>
              </tr>
            ))}
          </AdminTable>
        </>
      )}
      {result.pageCount > 1 ? (
        <Pagination
          ariaLabel="Paginação de pedidos administrativos"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
          summary={<>{formatCount(result.total, "pedido", "pedidos")}</>}
        />
      ) : null}
    </AdminCard>
  );
}
