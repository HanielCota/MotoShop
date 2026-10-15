import { History } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime, formatCount } from "@/lib/format";

import { adminHref } from "../../admin-href";
import {
  auditActionLabels,
  auditEntityGroups,
  formatAuditMetadata,
  getAuditActionLabel,
  getAuditEntityLabel,
} from "../../presentation/audit-log-presentation";
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

const actionOptions = [
  { value: "", label: "Todas" },
  ...Object.entries(auditActionLabels)
    .map(([value, label]) => ({ value, label }))
    .sort((first, second) => first.label.localeCompare(second.label, "pt-BR")),
];
const entityOptions = [
  { value: "", label: "Todos" },
  ...auditEntityGroups.map((group) => ({ value: group.value, label: group.label })),
];

function AuditMetadataDetails({ metadata }: { metadata: unknown }) {
  const lines = formatAuditMetadata(metadata);
  if (lines.length === 0) return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <details className="bg-surface-sunken max-w-sm rounded-md p-2 text-xs">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium sm:min-h-0">Detalhes</summary>
      <dl className="mt-1 space-y-1">
        {lines.map((line) => (
          <div key={line.label} className="flex flex-wrap gap-x-1">
            <dt className="text-muted-foreground">{line.label}:</dt>
            <dd className="break-words">{line.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

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
      description="Consulte alterações críticas com ator, registro e detalhes."
    >
      <AdminFilterForm resetHref={adminHref("audit", {})} label="Filtrar auditoria">
        <FilterSelect label="Ação" name="auditAction" value={params.auditAction ?? ""} options={actionOptions} />
        <FilterSelect
          label="Tipo de registro"
          name="auditEntityType"
          value={params.auditEntityType ?? ""}
          options={entityOptions}
        />
        <FilterText label="ID do registro" name="auditQ" value={params.auditQ} placeholder="Cole o ID interno" />
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
          columns={["Data", "Ação", "Registro", "Ator", "Detalhes"]}
          minWidth="min-w-[880px]"
        >
          {result.logs.map((log) => (
            <tr key={log.id}>
              <td className={`${cellClassName} text-muted-foreground whitespace-nowrap`}>
                {formatDateTime(log.createdAt)}
              </td>
              <td className={`${cellClassName} font-medium`}>{getAuditActionLabel(log.action)}</td>
              <td className={cellClassName}>{getAuditEntityLabel(log.entityType)}</td>
              <td className={cellClassName}>
                <p>{log.actor.name ?? log.actor.email}</p>
                <p className="text-muted-foreground text-xs break-all">{log.actor.email}</p>
              </td>
              <td className={cellClassName}>
                <AuditMetadataDetails metadata={log.metadata} />
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
          summary={<>{formatCount(result.total, "registro", "registros")}</>}
        />
      ) : null}
    </AdminCard>
  );
}
