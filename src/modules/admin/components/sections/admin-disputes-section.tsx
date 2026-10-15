import Link from "next/link";
import { Scale } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatCount } from "@/lib/format";
import { DisputeStatusActions } from "@/modules/disputes/components/dispute-status-actions";
import { listDisputesForAdmin } from "@/modules/disputes/queries/admin-disputes";
import { listSellerOptionsForAdmin } from "@/modules/sellers/queries/sellers";
import { getStatusLabel } from "@/shared/presentation/status-labels";

import { adminHref, adminOrderHref } from "../../admin-href";
import { adminDisputeStatusValues, loadAdminDisputeSearchParams } from "../../search-params";
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

const statusOptions = adminDisputeStatusValues.map((status) => ({
  value: status,
  label: status === "ALL" ? "Em aberto" : getStatusLabel("dispute", status),
}));

export async function AdminDisputesSection({ searchParams }: AdminSectionProps) {
  const params = await loadAdminDisputeSearchParams(searchParams);
  const [result, sellerOptions] = await Promise.all([
    listDisputesForAdmin({
      status: params.disputeStatus,
      q: params.disputeQ,
      sellerId: params.disputeSellerId,
      from: params.disputeFrom,
      to: params.disputeTo,
      sort: params.disputeSort,
      page: params.disputePage,
    }),
    listSellerOptionsForAdmin(),
  ]);
  const pageHref = (page: number) => adminHref("disputes", { ...params, disputePage: page }, { disputeSort: "oldest" });

  return (
    <AdminCard
      id="admin-disputes"
      title="Disputas"
      description="Faça a mediação entre cliente e lojista com histórico auditável."
    >
      <AdminFilterForm resetHref={adminHref("disputes", {})} label="Filtrar disputas">
        <FilterSelect
          label="Status da disputa"
          name="disputeStatus"
          value={params.disputeStatus}
          options={statusOptions}
        />
        <FilterText label="Buscar" name="disputeQ" value={params.disputeQ} placeholder="Pedido, item, SKU ou loja" />
        <FilterSelect
          label="Lojista"
          name="disputeSellerId"
          value={params.disputeSellerId ?? ""}
          options={sellerFilterOptions(sellerOptions)}
        />
        <FilterSelect
          label="Ordenação"
          name="disputeSort"
          value={params.disputeSort}
          options={oldestFirstSortOptions}
        />
        <FilterDateRange fromName="disputeFrom" toName="disputeTo" from={params.disputeFrom} to={params.disputeTo} />
      </AdminFilterForm>
      {result.disputes.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Nenhuma disputa aguardando ação"
          description="Disputas abertas por clientes aparecerão aqui."
        />
      ) : (
        <AdminList label="Disputas">
          {result.disputes.map((dispute) => (
            <li key={dispute.id} className="flex flex-col gap-4 py-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">
                    <Link
                      href={adminOrderHref(dispute.order.orderNumber)}
                      className="underline-offset-4 hover:underline"
                    >
                      Pedido {dispute.order.orderNumber}
                    </Link>
                  </h3>
                  <StatusBadge domain="dispute" status={dispute.status} />
                </div>
                <p className="text-muted-foreground text-sm break-words">
                  {dispute.seller.store?.name ?? "Lojista"} · {dispute.order.customerName} ·{" "}
                  {dispute.order.customerEmail}
                </p>
                <p className="mt-2 text-sm font-medium">{dispute.reason}</p>
                <p className="text-muted-foreground mt-1 text-sm break-words whitespace-pre-wrap">
                  {dispute.description}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">Aberta em {formatDateTime(dispute.createdAt)}</p>
              </div>
              <DisputeStatusActions
                disputeId={dispute.id}
                status={dispute.status}
                summary={{ orderNumber: dispute.order.orderNumber, storeName: dispute.seller.store?.name ?? "Lojista" }}
              />
            </li>
          ))}
        </AdminList>
      )}
      {result.pageCount > 1 ? (
        <Pagination
          ariaLabel="Paginação de disputas"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
          summary={<>{formatCount(result.total, "disputa", "disputas")}</>}
        />
      ) : null}
    </AdminCard>
  );
}
