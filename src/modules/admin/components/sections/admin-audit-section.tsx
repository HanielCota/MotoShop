import { History } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/format";

import { adminHref } from "../../admin-href";
import { listAuditLogsForAdmin } from "../../queries/audit-logs";
import { loadAdminAuditSearchParams } from "../../search-params";
import {
  AdminCard,
  AdminFilterForm,
  AdminTable,
  cellClassName,
  FilterDateRange,
  FilterSelect,
  FilterText,
  newestFirstSortOptions,
} from "../admin-ui";
import type { AdminSectionProps } from "./types";

export async function AdminAuditSection({ searchParams }: AdminSectionProps) {
  const params = await loadAdminAuditSearchParams(searchParams);
  const result = await listAuditLogsForAdmin({
    action: params.auditAction,
    entityType: params.auditEntityType,
    q: params.auditQ,
    actorQ: params.auditActorQ,
    from: params.auditFrom,
    to: params.auditTo,
    sort: params.auditSort,
    page: params.auditPage,
  });
  const pageHref = (page: number) => adminHref("audit", { ...params, auditPage: page }, { auditSort: "newest" });

  return (
    <AdminCard
      id="admin-audit"
      title="Auditoria administrativa"
      description="Consulte alterações críticas com ator, entidade e metadados registrados."
    >
      <AdminFilterForm resetHref={adminHref("audit", {})} label="Filtrar auditoria">
        <FilterText label="Ação" name="auditAction" value={params.auditAction} placeholder="ORDER_STATUS_CHANGED" />
        <FilterText
          label="Entidade"
          name="auditEntityType"
          value={params.auditEntityType}
          placeholder="Order ou SellerOrder"
        />
        <FilterText label="ID da entidade" name="auditQ" value={params.auditQ} placeholder="ID interno" />
        <FilterText label="Ator" name="auditActorQ" value={params.auditActorQ} placeholder="Nome ou e-mail" />
        <FilterDateRange fromName="auditFrom" toName="auditTo" from={params.auditFrom} to={params.auditTo} />
        <FilterSelect label="Ordenação" name="auditSort" value={params.auditSort} options={newestFirstSortOptions} />
      </AdminFilterForm>
      {result.logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhum registro de auditoria encontrado"
          description="Ajuste os filtros para consultar outro período ou entidade."
        />
      ) : (
        <AdminTable
          caption="Registros de auditoria"
          columns={["Data", "Ação", "Entidade", "Ator", "Metadados"]}
          minWidth="min-w-[880px]"
        >
          {result.logs.map((log) => (
            <tr key={log.id}>
              <td className={`${cellClassName} text-muted-foreground whitespace-nowrap`}>
                {formatDateTime(log.createdAt)}
              </td>
              <td className={`${cellClassName} font-medium`}>{log.action}</td>
              <td className={cellClassName}>
                <p>{log.entityType}</p>
                <p className="text-muted-foreground text-xs break-all">{log.entityId}</p>
              </td>
              <td className={cellClassName}>
                <p>{log.actor.name ?? log.actor.email}</p>
                <p className="text-muted-foreground text-xs break-all">{log.actor.email}</p>
              </td>
              <td className={cellClassName}>
                {log.metadata ? (
                  <pre className="bg-surface-sunken max-w-xs overflow-x-auto rounded-md p-2 text-[11px] whitespace-pre-wrap">
                    {JSON.stringify(log.metadata)}
                  </pre>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
      {result.pageCount > 1 ? (
        <Pagination
          ariaLabel="Paginação da auditoria"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
          summary={<>{result.total} registro(s)</>}
        />
      ) : null}
    </AdminCard>
  );
}
