import { Suspense } from "react";
import Link from "next/link";
import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { getSellerCatalogProgress } from "@/modules/sellers/queries/seller-catalog-progress";
import { getSellerDashboardContext } from "@/modules/sellers/application/get-seller-dashboard-context";
import { SellerApplicationStatus } from "@/modules/sellers/components/seller-application-status";
import { SellerCatalogProgress } from "@/modules/sellers/components/seller-catalog-progress";
import { SellerPendingInvites } from "@/modules/sellers/components/seller-pending-invites";
import { SellerOnboardingForm } from "@/modules/sellers/components/seller-onboarding-form";
import { SellerCardSkeleton, SellerStatsSkeleton } from "@/modules/sellers/components/dashboard/seller-card-skeleton";
import { SellerFinanceCard } from "@/modules/sellers/components/dashboard/seller-finance-card";
import { SellerInventoryHistoryCard } from "@/modules/sellers/components/dashboard/seller-inventory-history-card";
import { SellerLowStockCard } from "@/modules/sellers/components/dashboard/seller-low-stock-card";
import { SellerOverviewStats } from "@/modules/sellers/components/dashboard/seller-overview-stats";
import { getLegacySellerDashboardRedirect } from "@/modules/sellers/application/legacy-dashboard-links";
import { dashboardPanelsGridClassName } from "@/modules/sellers/domain/dashboard-grid";

export const metadata: Metadata = {
  title: "Central do Lojista",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function CatalogProgress({ sellerId }: { sellerId: string }) {
  return <SellerCatalogProgress progress={await getSellerCatalogProgress(sellerId)} />;
}

export default async function SellerHomePage({ searchParams }: { searchParams: SearchParams }) {
  const context = await getSellerDashboardContext();

  if (context.status === "no-seller") {
    return (
      <>
        <PageHeader
          eyebrow="Central do Lojista"
          title="Cadastre sua loja"
          description="Crie o perfil da sua loja para começar o processo de aprovação pelo Moto Shop."
        />
        <SellerPendingInvites />
        <Card>
          <CardContent>
            <SellerOnboardingForm />
          </CardContent>
        </Card>
      </>
    );
  }

  if (context.status === "pending") {
    return (
      <>
        <PageHeader eyebrow="Central do Lojista" title={context.seller.store?.name ?? "Sua loja"} />
        <SellerApplicationStatus
          storeName={context.seller.store?.name ?? "Sua loja"}
          status={context.seller.status}
          rejectionReason={context.seller.rejectionReason}
        />
      </>
    );
  }

  const query = await searchParams;
  // Links antigos apontavam filtros de produtos/cupons para /seller; envia para as novas páginas.
  const legacyRedirect = getLegacySellerDashboardRedirect(query);
  if (legacyRedirect) redirect(legacyRedirect as Route);

  const { seller, permissions } = context;

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title={seller.store?.name ?? "Sua loja"}
        description="Acompanhe o que precisa de atenção hoje: pedidos, perguntas, estoque e vendas."
        actions={
          permissions.canCreateProduct ? (
            <Link href="/seller/products/new" className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden="true" />
              Novo produto
            </Link>
          ) : null
        }
      />
      {query.error === "permission" ? (
        <FormMessage error="Seu perfil na equipe não tem acesso a essa área. Fale com o responsável pela loja." />
      ) : null}
      <Suspense fallback={<SellerStatsSkeleton />}>
        <SellerOverviewStats sellerId={seller.id} permissions={permissions} />
      </Suspense>
      {permissions.canManageCatalog ? (
        <Suspense fallback={<SellerCardSkeleton rows={1} label="Carregando progresso da loja" />}>
          <CatalogProgress sellerId={seller.id} />
        </Suspense>
      ) : null}
      {permissions.canManageCatalog || permissions.canReadFinances ? (
        <div className={dashboardPanelsGridClassName(countVisiblePanels(permissions))}>
          {permissions.canManageCatalog ? (
            <Suspense fallback={<SellerCardSkeleton label="Carregando estoque baixo" />}>
              <SellerLowStockCard sellerId={seller.id} />
            </Suspense>
          ) : null}
          {permissions.canReadFinances ? (
            <Suspense fallback={<SellerCardSkeleton label="Carregando resumo financeiro" />}>
              <SellerFinanceCard sellerId={seller.id} />
            </Suspense>
          ) : null}
        </div>
      ) : null}
      {permissions.canManageCatalog ? (
        <Suspense fallback={<SellerCardSkeleton rows={4} label="Carregando histórico de estoque" />}>
          <SellerInventoryHistoryCard sellerId={seller.id} searchParams={searchParams} summary />
        </Suspense>
      ) : null}
    </>
  );
}

/** Low stock (catalog) and finance panels shown to this member. */
function countVisiblePanels(permissions: { canManageCatalog: boolean; canReadFinances: boolean }) {
  return [permissions.canManageCatalog, permissions.canReadFinances].filter(Boolean).length;
}
