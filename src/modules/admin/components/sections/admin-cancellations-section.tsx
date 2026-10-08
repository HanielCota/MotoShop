import { Ban } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatMoneyInCents } from "@/lib/format";
import { CancellationStatusActions } from "@/modules/returns/components/cancellation-status-actions";
import { listCancellationRequestsForAdmin } from "@/modules/returns/queries/admin-cancellations";
import { listSellerOptionsForAdmin } from "@/modules/sellers/queries/sellers";
import { getStatusLabel } from "@/shared/presentation/status-labels";

import { adminHref } from "../../admin-href";
import { adminCancellationStatusValues, loadAdminCancellationSearchParams } from "../../search-params";
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

const statusOptions = adminCancellationStatusValues.map((status) => ({
  value: status,
  label: status === "ALL" ? "Em aberto" : getStatusLabel("cancellation", status),
}));

export async function AdminCancellationsSection({ searchParams }: AdminSectionProps) {
  const params = await loadAdminCancellationSearchParams(searchParams);
  const [result, sellerOptions] = await Promise.all([
    listCancellationRequestsForAdmin({
      status: params.cancellationStatus,
      q: params.cancellationQ,
      sellerId: params.cancellationSellerId,
      from: params.cancellationFrom,
      to: params.cancellationTo,
      sort: params.cancellationSort,
      page: params.cancellationPage,
    }),
    listSellerOptionsForAdmin(),
  ]);
  const pageHref = (page: number) =>
    adminHref("cancellations", { ...params, cancellationPage: page }, { cancellationSort: "oldest" });

  return (
    <AdminCard
      id="admin-cancellations"
      title="Cancelamentos"
      description="Analise pedidos ainda não postados; pedidos enviados seguem o fluxo de devolução."
    >
      <AdminFilterForm resetHref={adminHref("cancellations", {})} label="Filtrar cancelamentos">
        <FilterSelect
          label="Status do cancelamento"
          name="cancellationStatus"
          value={params.cancellationStatus}
          options={statusOptions}
        />
        <FilterText
          label="Buscar"
          name="cancellationQ"
          value={params.cancellationQ}
          placeholder="Pedido, item, SKU ou loja"
        />
        <FilterSelect
          label="Lojista"
          name="cancellationSellerId"
          value={params.cancellationSellerId ?? ""}
          options={sellerFilterOptions(sellerOptions)}
        />
        <FilterSelect
          label="Ordenação"
          name="cancellationSort"
          value={params.cancellationSort}
          options={oldestFirstSortOptions}
        />
        <FilterDateRange
          fromName="cancellationFrom"
          toName="cancellationTo"
          from={params.cancellationFrom}
          to={params.cancellationTo}
        />
      </AdminFilterForm>
      {result.requests.length === 0 ? (
        <EmptyState
          icon={Ban}
          title="Nenhum cancelamento aguardando ação"
          description="Novas solicitações de clientes aparecerão aqui."
        />
      ) : (
        <AdminList label="Solicitações de cancelamento">
          {result.requests.map((request) => (
            <li key={request.id} className="flex flex-col gap-4 py-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">Pedido {request.order.orderNumber}</h3>
                  <StatusBadge domain="cancellation" status={request.status} />
                </div>
                <p className="text-muted-foreground text-sm break-words">
                  {request.seller.store?.name ?? "Lojista"} · {request.order.customerName} ·{" "}
                  {request.order.customerEmail}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {request.sellerOrder.items
                    .map((item) => `${item.productNameSnapshot} (${item.quantity})`)
                    .join(" · ")}{" "}
                  · {formatMoneyInCents(request.amountInCents)}
                </p>
                {request.customerMessage ? (
                  <p className="text-muted-foreground mt-1 text-xs">Motivo: {request.customerMessage}</p>
                ) : null}
                <p className="text-muted-foreground mt-1 text-xs">Solicitado em {formatDateTime(request.createdAt)}</p>
              </div>
              {request.status === "REQUESTED" || request.status === "APPROVED" ? (
                <CancellationStatusActions cancellationRequestId={request.id} status={request.status} />
              ) : null}
            </li>
          ))}
        </AdminList>
      )}
      {result.pageCount > 1 ? (
        <Pagination
          ariaLabel="Paginação de cancelamentos"
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
