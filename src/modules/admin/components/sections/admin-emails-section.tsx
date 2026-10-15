import { Mail } from "lucide-react";

import { ActionForm } from "@/components/ui/action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatCount } from "@/lib/format";
import { getStatusOptions } from "@/shared/presentation/status-labels";

import { resendNotificationDeliveryAction } from "../../actions/notification-delivery-actions";
import { adminHref } from "../../admin-href";
import { listNotificationDeliveriesForAdmin } from "../../queries/notification-deliveries";
import { loadAdminNotificationSearchParams } from "../../search-params";
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

export async function AdminEmailsSection({ searchParams }: AdminSectionProps) {
  const params = await loadAdminNotificationSearchParams(searchParams);
  const result = await listNotificationDeliveriesForAdmin({
    status: params.notificationStatus,
    q: params.notificationQ,
    kind: params.notificationKind,
    from: params.notificationFrom,
    to: params.notificationTo,
    sort: params.notificationSort,
    page: params.notificationPage,
  });
  const pageHref = (page: number) =>
    adminHref("emails", { ...params, notificationPage: page }, { notificationSort: "newest" });

  return (
    <AdminCard
      id="admin-emails"
      title="Entregas de notificações"
      description="Acompanhe os e-mails transacionais enviados pelo Moto Shop."
    >
      <AdminFilterForm resetHref={adminHref("emails", {})} label="Filtrar entregas">
        <FilterText
          label="Buscar entrega"
          name="notificationQ"
          value={params.notificationQ}
          placeholder="E-mail, assunto ou evento"
        />
        <FilterText label="Tipo" name="notificationKind" value={params.notificationKind} placeholder="ORDER_PAYMENT" />
        <FilterSelect
          label="Status"
          name="notificationStatus"
          value={params.notificationStatus ?? "ALL"}
          options={[{ value: "ALL", label: "Todos" }, ...getStatusOptions("notification")]}
        />
        <FilterSelect
          label="Ordenação"
          name="notificationSort"
          value={params.notificationSort}
          options={newestFirstSortOptions}
        />
        <FilterDateRange
          fromName="notificationFrom"
          toName="notificationTo"
          from={params.notificationFrom}
          to={params.notificationTo}
        />
      </AdminFilterForm>
      {result.deliveries.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Nenhuma entrega encontrada"
          description="Ajuste os filtros para ver outras entregas de e-mail."
        />
      ) : (
        <AdminTable caption="Entregas de notificações" columns={["Tipo", "Destinatário", "Status", "Criado em"]}>
          {result.deliveries.map((delivery) => (
            <tr key={delivery.id}>
              <td className={cellClassName}>
                <p className="font-medium">{delivery.kind}</p>
                {delivery.error ? (
                  <p className="text-destructive mt-1 max-w-sm text-xs break-words">{delivery.error}</p>
                ) : null}
              </td>
              <td className={cellClassName}>
                <p className="break-all">{delivery.recipientEmail}</p>
                <p className="text-muted-foreground text-xs">{delivery.subject}</p>
              </td>
              <td className={cellClassName}>
                <StatusBadge domain="notification" status={delivery.status} />
                {delivery.retryable ? (
                  <ActionForm action={resendNotificationDeliveryAction.bind(null, delivery.id)} className="mt-1">
                    <button type="submit" className="text-brand-text text-xs font-medium underline underline-offset-4">
                      Reenviar
                    </button>
                  </ActionForm>
                ) : null}
              </td>
              <td className={`${cellClassName} text-muted-foreground whitespace-nowrap`}>
                {formatDateTime(delivery.createdAt)}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
      {result.pageCount > 1 ? (
        <Pagination
          ariaLabel="Paginação de notificações"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
          summary={<>{formatCount(result.total, "entrega", "entregas")}</>}
        />
      ) : null}
    </AdminCard>
  );
}
