import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, TicketPercent, Truck } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { requireSellerDashboardContext } from "@/modules/sellers/application/get-seller-dashboard-context";
import { SellerStoreSettingsSection } from "@/modules/sellers/components/dashboard/seller-store-settings-section";
import { SellerTeamCard } from "@/modules/sellers/components/dashboard/seller-team-card";
import { SellerVipCard } from "@/modules/sellers/components/dashboard/seller-vip-card";

function SettingsShortcut({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: Route;
  title: string;
  description: string;
  icon: typeof Truck;
}) {
  return (
    <Link
      href={href}
      className="bg-card ring-foreground/10 hover:ring-foreground/25 flex min-h-11 items-center gap-3 rounded-xl p-4 ring-1 transition-shadow"
    >
      <span className="bg-moto-brand-surface text-brand-strong grid size-9 shrink-0 place-items-center rounded-lg">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="text-muted-foreground block text-sm">{description}</span>
      </span>
      <ChevronRight className="text-muted-foreground size-4" aria-hidden="true" />
    </Link>
  );
}

export default async function SellerSettingsPage() {
  const { seller, store, permissions } = await requireSellerDashboardContext();

  return (
    <>
      <PageHeader
        eyebrow="Sua loja"
        title="Configurações"
        description="Perfil público, identidade visual, remetente, equipe e plano da loja."
      />
      {permissions.canManageStore || permissions.canManageCoupons ? (
        <nav aria-label="Outras configurações" className="grid gap-3 sm:grid-cols-2">
          {permissions.canManageStore ? (
            <SettingsShortcut
              href={"/seller/shipping" as Route}
              title="Frete próprio e integrações"
              description="Modalidades de entrega e conta do Melhor Envio."
              icon={Truck}
            />
          ) : null}
          {permissions.canManageCoupons ? (
            <SettingsShortcut
              href={"/seller/coupons" as Route}
              title="Cupons"
              description="Descontos financiados pela sua loja."
              icon={TicketPercent}
            />
          ) : null}
        </nav>
      ) : null}
      <SellerStoreSettingsSection store={store} canManageStore={permissions.canManageStore} />
      {permissions.canManageStore ? <SellerTeamCard members={seller.members} /> : null}
      <SellerVipCard subscription={seller.subscriptions[0]} />
    </>
  );
}
