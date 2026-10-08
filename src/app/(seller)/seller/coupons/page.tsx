import { Suspense } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { SellerCouponsCard } from "@/modules/coupons/components/seller-coupons-card";
import { requireSellerPageContext } from "@/modules/sellers/application/get-seller-dashboard-context";
import { SellerCardSkeleton } from "@/modules/sellers/components/dashboard/seller-card-skeleton";

export default async function SellerCouponsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { seller } = await requireSellerPageContext("COUPON_MANAGE");

  return (
    <>
      <PageHeader
        eyebrow="Promoções"
        title="Cupons"
        description="Crie e acompanhe cupons de desconto financiados pela sua loja."
      />
      <Suspense fallback={<SellerCardSkeleton rows={4} label="Carregando cupons" />}>
        <SellerCouponsCard sellerId={seller.id} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
