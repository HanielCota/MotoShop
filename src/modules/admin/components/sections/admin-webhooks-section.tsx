import { Webhook } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/format";
import { getStatusOptions } from "@/shared/presentation/status-labels";

import { retryWebhookEventAction } from "../../actions/webhook-actions";
import { adminHref } from "../../admin-href";
import { listWebhookEventsForAdmin } from "../../queries/webhook-events";
import { loadAdminWebhookSearchParams } from "../../search-params";
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

export async function AdminWebhooksSection({ searchParams }: AdminSectionProps) {
  const params = await loadAdminWebhookSearchParams(searchParams);
  const result = await listWebhookEventsForAdmin({
    status: params.webhookStatus,
    q: params.webhookQ,
    provider: params.webhookProvider,
    from: params.webhookFrom,
    to: params.webhookTo,
    sort: params.webhookSort,
    page: params.webhookPage,
  });
  const pageHref = (page: number) => adminHref("webhooks", { ...params, webhookPage: page }, { webhookSort: "newest" });

  return (
    <AdminCard
      id="admin-webhooks"
      title="Eventos de webhook"
      description="Monitore recebimento, processamento e falhas de integrações críticas."
    >
      <AdminFilterForm resetHref={adminHref("webhooks", {})} label="Filtrar webhooks">
        <FilterText label="Buscar evento" name="webhookQ" value={params.webhookQ} placeholder="Tipo, ID ou erro" />
        <FilterText label="Provedor" name="webhookProvider" value={params.webhookProvider} placeholder="MERCADO_PAGO" />
        <FilterSelect
          label="Status"
          name="webhookStatus"
          value={params.webhookStatus ?? "ALL"}
          options={[{ value: "ALL", label: "Todos" }, ...getStatusOptions("webhook")]}
        />
        <FilterSelect
          label="Ordenação"
          name="webhookSort"
          value={params.webhookSort}
          options={newestFirstSortOptions}
        />
        <FilterDateRange fromName="webhookFrom" toName="webhookTo" from={params.webhookFrom} to={params.webhookTo} />
      </AdminFilterForm>
      {result.events.length === 0 ? (
        <EmptyState
          icon={Webhook}
          title="Nenhum webhook encontrado"
          description="Ajuste os filtros ou aguarde novos eventos das integrações."
        />
      ) : (
        <AdminTable caption="Eventos de webhook" columns={["Evento", "Status", "Recebido em", "Detalhes"]}>
          {result.events.map((event) => (
            <tr key={event.id}>
              <td className={cellClassName}>
                <p className="font-medium">{event.type}</p>
                <p className="text-muted-foreground text-xs">
                  {event.provider} · {event.externalId}
                </p>
              </td>
              <td className={cellClassName}>
                <StatusBadge domain="webhook" status={event.status} />
              </td>
              <td className={`${cellClassName} text-muted-foreground whitespace-nowrap`}>
                {formatDateTime(event.receivedAt)}
              </td>
              <td className={cellClassName}>
                <div className="flex flex-col items-start gap-1">
                  {event.error ? <p className="text-destructive max-w-sm text-xs break-words">{event.error}</p> : null}
                  {event.status === "FAILED" ? (
                    <form action={retryWebhookEventAction.bind(null, event.id)}>
                      <button type="submit" className="text-brand-text text-xs font-medium underline underline-offset-4">
                        Reprocessar
                      </button>
                    </form>
                  ) : null}
                  {!event.error && event.status !== "FAILED" ? (
                    <span className="text-muted-foreground text-xs">—</span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
      {result.pageCount > 1 ? (
        <Pagination
          ariaLabel="Paginação de webhooks"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
          summary={<>{result.total} evento(s)</>}
        />
      ) : null}
    </AdminCard>
  );
}
