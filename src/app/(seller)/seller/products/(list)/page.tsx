import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { History, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SellerProductsCard } from "@/modules/products/components/seller-products-card";
import { requireSellerPageContext } from "@/modules/sellers/application/get-seller-dashboard-context";
import { SellerCardSkeleton } from "@/modules/sellers/components/dashboard/seller-card-skeleton";

export const metadata: Metadata = {
  title: "Produtos · Central do Lojista",
  robots: { index: false, follow: false },
};

export default async function SellerProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { seller, permissions } = await requireSellerPageContext("PRODUCT_UPDATE");

  return (
    <>
      <PageHeader
        eyebrow="Catálogo"
        title="Produtos"
        description="Cadastre, edite, envie para aprovação e ajuste o estoque de cada variação."
        actions={
          <>
            <Link
              href="/seller/products/inventory-history"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <History aria-hidden="true" />
              Histórico de estoque
            </Link>
            {permissions.canCreateProduct ? (
              <Link href="/seller/products/new" className={buttonVariants({ size: "lg" })}>
                <Plus aria-hidden="true" />
                Novo produto
              </Link>
            ) : null}
          </>
        }
      />
      <Suspense fallback={<SellerCardSkeleton rows={5} label="Carregando produtos" />}>
        <SellerProductsCard
          sellerId={seller.id}
          searchParams={searchParams}
          canCreateProduct={permissions.canCreateProduct}
        />
      </Suspense>
    </>
  );
}
