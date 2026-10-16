import Link from "next/link";
import { Undo2 } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatMoneyInCents } from "@/lib/format";
import { ReturnStatusActions } from "@/modules/returns/components/return-status-actions";
import { listReturnRequestsForAdmin } from "@/modules/returns/queries/admin-returns";
import { listSellerOptionsForAdmin } from "@/modules/sellers/queries/sellers";
import { getStatusLabel, returnReasonLabels } from "@/shared/presentation/status-labels";

import { adminHref, adminOrderHref } from "../../admin-href";
import { adminReturnStatusValues, loadAdminReturnSearchParams } from "../../search-params";
import {
  AdminCard,
  AdminFilterForm,
  AdminList,
  FilterDateRange,
  FilterSelect,
  FilterText,
  oldestFirstSortOptions,
  sellerFilterOptions,
} from "../admin-ui";
import type { AdminSectionProps } from "./types";

const statusOptions = adminReturnStatusValues.map((status) => ({
  value: status,
  label: status === "ALL" ? "Em aberto" : getStatusLabel("return", status),
}));

export async function AdminReturnsSection({ searchParams }: AdminSectionProps) {
  const params = await loadAdminReturnSearchParams(searchParams);
  const [result, sellerOptions] = await Promise.all([
    listReturnRequestsForAdmin({
      status: params.returnStatus,
      q: params.returnQ,
      sellerId: params.returnSellerId,
      from: params.returnFrom,
      to: params.returnTo,
      sort: params.returnSort,
      page: params.returnPage,
    }),
    listSellerOptionsForAdmin(),
  ]);
  const pageHref = (page: number) => adminHref("returns", { ...params, returnPage: page }, { returnSort: "oldest" });

  return (
    <AdminCard
      id="admin-returns"
      title="Devoluções e reembolsos"
      description="Avalie solicitações, registre o recebimento físico e só então processe o reembolso."
    >
      <AdminFilterForm resetHref={adminHref("returns", {})} label="Filtrar devoluções">
        <FilterSelect
          label="Status da devolução"
          name="returnStatus"
          value={params.returnStatus}
          options={statusOptions}
        />
        <FilterText
          label="Buscar"
          name="returnQ"
          value={params.returnQ}
          placeholder="Pedido, item, SKU, loja ou motivo"
        />
        <FilterSelect
          label="Lojista"
          name="returnSellerId"
          value={params.returnSellerId ?? ""}
          options={sellerFilterOptions(sellerOptions)}
        />
        <FilterSelect label="Ordenação" name="returnSort" value={params.returnSort} options={oldestFirstSortOptions} />
        <FilterDateRange fromName="returnFrom" toName="returnTo" from={params.returnFrom} to={params.returnTo} />
      </AdminFilterForm>
      {result.requests.length === 0 ? (
        <EmptyState
          icon={Undo2}
          title="Nenhuma devolução aguardando ação"
          description="Novas solicitações de devolução aparecerão aqui."
        />
      ) : (
        <AdminList label="Solicitações de devolução">
          {result.requests.map((request) => {
            const item = request.items[0];
            return (
              <li key={request.id} className="flex flex-col gap-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">
                      <Link
                        href={adminOrderHref(request.order.orderNumber)}
                        className="underline-offset-4 hover:underline"
                      >
                        Pedido {request.order.orderNumber}
                      </Link>
                    </h3>
                    <StatusBadge domain="return" status={request.status} />
                  </div>
                  <p className="text-muted-foreground text-sm break-words">
                    {request.seller.store?.name ?? "Lojista"} · {request.order.customerName} ·{" "}
                    {request.order.customerEmail}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {item?.orderItem.productNameSnapshot ?? "Item"} · quantidade {item?.quantity ?? 0} · valor estimado{" "}
                    {formatMoneyInCents(request.amountInCents)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Motivo: {returnReasonLabels[request.reason] ?? request.reason}
                    {request.customerMessage ? ` · ${request.customerMessage}` : ""}
                  </p>
                  {request.adminNote ? (
                    <p className="text-muted-foreground mt-1 text-xs">Nota: {request.adminNote}</p>
                  ) : null}
                  <p className="text-muted-foreground mt-1 text-xs">
                    Solicitada em {formatDateTime(request.createdAt)}
                  </p>
                </div>
                <ReturnStatusActions
                  returnRequestId={request.id}
                  status={request.status}
                  summary={{
                    orderNumber: request.order.orderNumber,
                    storeName: request.seller.store?.name ?? "Lojista",
                    amountInCents: request.amountInCents,
                  }}
                />
              </li>
            );
          })}
        </AdminList>
      )}
      {result.pageCount > 1 ? (
        <Pagination
          ariaLabel="Paginação de devoluções"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
          summary={<>{result.total} solicitação(ões)</>}
        />
      ) : null}
    </AdminCard>
  );
}
