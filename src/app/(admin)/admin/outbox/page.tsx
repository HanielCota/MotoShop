import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/format";
import { AdminCard, AdminTable, cellClassName } from "@/modules/admin/components/admin-ui";
import { listFailedOutboxEventsForAdmin } from "@/modules/admin/queries/outbox-events";
import { requireAdminAccess } from "@/modules/auth/application/authorization";

export const metadata = { title: "Eventos pendentes | Admin O Moto Shop" };

export default async function AdminOutboxPage() {
  await requireAdminAccess();
  const { events, total } = await listFailedOutboxEventsForAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Eventos pendentes"
        description="Eventos de pagamento e envio que esgotaram as tentativas de encaminhamento."
      />
      <AdminCard
        id="admin-outbox"
        title="Eventos que precisam de atenção"
        description="Esta tela é somente para consulta."
        actions={<Badge variant={total > 0 ? "destructive" : "success"}>{total} falha(s)</Badge>}
      >
        {events.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nenhum evento exige atenção no momento"
            description="Eventos que falharem após todas as tentativas aparecerão aqui."
          />
        ) : (
          <AdminTable
            caption="Eventos com falha"
            columns={["Evento", "Registro", "Status", "Último erro", "Atualizado em"]}
            minWidth="min-w-[820px]"
          >
            {events.map((event) => (
              <tr key={event.id}>
                <td className={`${cellClassName} font-medium`}>{event.eventName}</td>
                <td className={cellClassName}>
                  <p>{event.aggregateType}</p>
                  <p className="text-muted-foreground text-xs break-all">{event.aggregateId}</p>
                </td>
                <td className={cellClassName}>
                  <StatusBadge domain="outbox" status="FAILED" />
                  <p className="text-muted-foreground mt-1 text-xs">{event.attempts} tentativa(s)</p>
                </td>
                <td className={`${cellClassName} max-w-xs text-xs break-words`}>
                  {event.lastError ?? "Não informado"}
                </td>
                <td className={`${cellClassName} text-muted-foreground whitespace-nowrap`}>
                  {formatDateTime(event.updatedAt)}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
        {total > events.length ? (
          <p className="text-muted-foreground text-xs">Exibindo os 50 eventos mais recentes de {total}.</p>
        ) : null}
        <p className="text-muted-foreground border-t pt-4 text-xs">
          Reprocessar pode gerar uma notificação externa; primeiro confirme o estado do evento no Inngest e no histórico
          de entregas.
        </p>
      </AdminCard>
    </div>
  );
}
