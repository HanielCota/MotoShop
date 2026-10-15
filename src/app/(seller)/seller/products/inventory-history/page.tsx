import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { requireSellerPageContext } from "@/modules/sellers/application/get-seller-dashboard-context";
import { SellerCardSkeleton } from "@/modules/sellers/components/dashboard/seller-card-skeleton";
import { SellerInventoryHistoryCard } from "@/modules/sellers/components/dashboard/seller-inventory-history-card";

export const metadata: Metadata = {
  title: "Histórico de estoque · Central do Lojista",
  robots: { index: false, follow: false },
};

export default async function SellerInventoryHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { seller } = await requireSellerPageContext("PRODUCT_UPDATE");

  return (
    <>
      <PageHeader
        eyebrow="Catálogo"
        title="Histórico de estoque"
        description="Vendas, reservas, devoluções e ajustes manuais de cada variação."
        back={{ href: "/seller/products", label: "Produtos" }}
      />
      <Suspense fallback={<SellerCardSkeleton rows={5} label="Carregando histórico de estoque" />}>
        <SellerInventoryHistoryCard sellerId={seller.id} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
