import type { Route } from "next";
import { Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatMoneyInCents, formatPercentFromBps } from "@/lib/format";

import { listMarketplaceCouponsForSeller } from "../queries/coupon-participation";
import { loadCouponSearchParams, serializeCouponSearchParams } from "../search-params";
import { CampaignParticipationButton } from "./campaign-participation-button";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const basePath = "/seller/coupons";

export async function SellerCampaignsCard({
  sellerId,
  searchParams,
}: {
  sellerId: string;
  searchParams: SearchParams;
}) {
  const params = await loadCouponSearchParams(searchParams);
  const result = await listMarketplaceCouponsForSeller(sellerId, { page: params.campaignPage });
  const pageHref = (page: number) =>
    `${serializeCouponSearchParams(basePath, { ...params, campaignPage: page })}#seller-campaigns` as Route;

  return (
    <Card id="seller-campaigns" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Campanhas do Moto Shop</CardTitle>
        <CardDescription>
          Ao entrar, o desconto da campanha sai do valor da sua loja nos itens vendidos com o cupom.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.coupons.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Nenhuma campanha aberta"
            description="Quando o Moto Shop abrir uma campanha, ela aparece aqui para sua loja entrar."
          />
        ) : (
          <ul className="divide-border divide-y">
            {result.coupons.map((campaign) => (
              <li key={campaign.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold">{campaign.code}</p>
                  <p className="text-muted-foreground text-sm">
                    {campaignDiscountLabel(campaign)}
                    {campaign.minimumPurchaseInCents > 0
                      ? ` · compra mínima de ${formatMoneyInCents(campaign.minimumPurchaseInCents)}`
                      : ""}
                    {campaign.endsAt ? ` · até ${formatDate(campaign.endsAt)}` : " · sem prazo"}
                  </p>
                  {campaign.joined && campaign.joinedAt ? (
                    <Badge variant="success">Sua loja participa desde {formatDate(campaign.joinedAt)}</Badge>
                  ) : null}
                </div>
                <CampaignParticipationButton couponId={campaign.id} joined={campaign.joined} />
              </li>
            ))}
          </ul>
        )}
        {result.pageCount > 1 ? (
          <Pagination
            ariaLabel="Paginação das campanhas do Moto Shop"
            page={result.page}
            pageCount={result.pageCount}
            previousHref={pageHref(result.page - 1)}
            nextHref={pageHref(result.page + 1)}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function campaignDiscountLabel(campaign: {
  discountType: string;
  percentageBps: number | null;
  fixedAmountInCents: number | null;
}) {
  return campaign.discountType === "PERCENTAGE"
    ? `${formatPercentFromBps(campaign.percentageBps ?? 0)} de desconto`
    : `${formatMoneyInCents(campaign.fixedAmountInCents ?? 0)} de desconto`;
}
