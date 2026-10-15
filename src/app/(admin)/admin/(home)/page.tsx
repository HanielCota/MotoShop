import type { Route } from "next";
// KPI icons show the object counted, never a state (IC-20): the label already says "com falha".
import { FileX2, Mail, PackageSearch, Scale, Send, Store, Truck, Undo2, Webhook } from "lucide-react";

import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { getAdminDashboardCounters } from "@/modules/admin/queries/dashboard-counters";
import { formatCount } from "@/lib/format";

export const metadata = { title: "Visão geral · Admin" };

export default async function AdminHomePage() {
  await requireAdminAccess();
  const counters = await getAdminDashboardCounters();

  const pending = [
    {
      label: "Lojas aguardando análise",
      value: counters.pendingSellers,
      href: "/admin/sellers?sellerStatus=PENDING",
      icon: Store,
    },
    {
      label: "Produtos para revisar",
      value: counters.submittedProducts,
      href: "/admin/products?productReviewStatus=SUBMITTED",
      icon: PackageSearch,
    },
    {
      label: "Cancelamentos solicitados",
      value: counters.requestedCancellations,
      href: "/admin/cancellations?cancellationStatus=REQUESTED",
      icon: FileX2,
    },
    {
      label: "Devoluções solicitadas",
      value: counters.requestedReturns,
      href: "/admin/returns?returnStatus=REQUESTED",
      icon: Undo2,
    },
    { label: "Disputas em aberto", value: counters.openDisputes, href: "/admin/disputes", icon: Scale },
    {
      label: "Etiquetas para conferir",
      value: counters.shipmentsNeedingReconciliation,
      href: "/admin/shipping-recovery",
      icon: Truck,
    },
  ];

  const system = [
    {
      label: "Webhooks com falha",
      value: counters.failedWebhooks,
      href: "/admin/webhooks?webhookStatus=FAILED",
      icon: Webhook,
    },
    {
      label: "E-mails com falha",
      value: counters.failedNotifications,
      href: "/admin/emails?notificationStatus=FAILED",
      icon: Mail,
    },
    {
      label: "Eventos pendentes com falha",
      value: counters.failedOutboxEvents,
      href: "/admin/outbox",
      icon: Send,
    },
  ];

  const totalPending = pending.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Painel administrativo"
        title="Visão geral"
        description="Filas que esperam um administrador e falhas de integração. As demais áreas ficam no menu."
      />

      <section aria-labelledby="pending-heading" className="space-y-4">
        <SectionHeader
          title={<span id="pending-heading">Aguardando ação</span>}
          description={
            totalPending > 0
              ? `${formatCount(totalPending, "item aguardando", "itens aguardando")} um administrador.`
              : "Nada pendente no momento."
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pending.map((item) => (
            <StatCard
              key={item.href}
              label={item.label}
              value={item.value}
              href={item.href as Route}
              icon={item.icon}
              tone={item.value > 0 ? "attention" : "default"}
              hint={item.value > 0 ? "Abrir fila" : "Em dia"}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="system-heading" className="space-y-4">
        <SectionHeader
          title={<span id="system-heading">Saúde das integrações</span>}
          description="Falhas que podem exigir reprocessamento ou conferência manual."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {system.map((item) => (
            <StatCard
              key={item.href}
              label={item.label}
              value={item.value}
              href={item.href as Route}
              icon={item.icon}
              tone={item.value > 0 ? "attention" : "default"}
              hint={item.value > 0 ? "Verificar agora" : "Sem falhas"}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
