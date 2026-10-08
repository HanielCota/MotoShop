import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Mail,
  PackageSearch,
  Scale,
  Store,
  Truck,
  Undo2,
  Webhook,
} from "lucide-react";

import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { adminSections } from "@/modules/admin/admin-sections";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { getAdminDashboardCounters } from "@/modules/admin/queries/dashboard-counters";
import { formatCount } from "@/lib/format";

export const metadata = { title: "Visão geral · Admin" };

const groups = ["Marketplace", "Operação", "Sistema"] as const;

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
      icon: Ban,
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
      icon: AlertTriangle,
    },
  ];

  const totalPending = pending.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Painel administrativo"
        title="Visão geral"
        description="Acompanhe o que precisa de atenção e abra cada área para trabalhar com seus próprios filtros e registros."
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

      {groups.map((group) => (
        <section key={group} aria-labelledby={`group-${group}`} className="space-y-4">
          <h2 id={`group-${group}`} className="text-xl sm:text-2xl">
            {group}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {adminSections
              .filter((section) => section.group === group)
              .map((section) => (
                <Link
                  key={section.slug}
                  href={`/admin/${section.slug}` as Route}
                  className="group bg-card ring-foreground/10 hover:ring-moto-brand focus-visible:outline-ring flex min-h-28 flex-col justify-between rounded-xl p-5 ring-1 transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <span className="flex items-start justify-between gap-3 text-base font-semibold">
                    {section.title}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="text-muted-foreground group-hover:text-brand-strong size-4 shrink-0"
                    />
                  </span>
                  <span className="text-muted-foreground mt-3 text-sm">{section.description}</span>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
