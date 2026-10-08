import { Crown } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/format";
import { listSellersForAdmin } from "@/modules/sellers/queries/sellers";
import { VipSubscriptionForm } from "@/modules/subscriptions/components/vip-subscription-form";

import { adminHref } from "../../admin-href";
import { loadAdminSellerSearchParams } from "../../search-params";
import { AdminCard } from "../admin-ui";
import type { AdminSectionProps } from "./types";

export async function AdminVipSection({ searchParams }: AdminSectionProps) {
  const params = await loadAdminSellerSearchParams(searchParams);
  const result = await listSellersForAdmin({
    status: params.sellerStatus,
    q: params.sellerQ,
    sort: params.sellerSort,
    page: params.sellerPage,
  });
  const vipSellers = result.sellers.filter((seller) => seller.subscriptions.length > 0);
  const pageHref = (page: number) => adminHref("vip", { ...params, sellerPage: page }, { sellerSort: "newest" });

  return (
    <AdminCard
      id="admin-vip"
      title="Plano VIP e exposição"
      description="Ative o VIP manualmente enquanto a cobrança recorrente ainda não está integrada. O selo patrocinado é exibido na vitrine e o destaque é um critério pequeno, depois de relevância, estoque e reputação."
    >
      <VipSubscriptionForm
        sellers={result.sellers
          .filter((seller) => seller.status === "APPROVED" || seller.status === "ACTIVE")
          .map((seller) => ({
            id: seller.id,
            name: seller.store?.name ?? "Sem loja",
            hasActiveVip: seller.subscriptions.length > 0,
          }))}
      />
      <section aria-labelledby="admin-vip-active" className="space-y-2">
        <h3 id="admin-vip-active" className="font-semibold">
          Lojas com VIP ativo
        </h3>
        {vipSellers.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={Crown}
            title="Nenhuma loja com VIP ativo nesta página"
            description="Use o formulário acima para ativar o plano de uma loja aprovada."
          />
        ) : (
          <ul className="divide-border divide-y">
            {vipSellers.map((seller) => {
              const endsAt = seller.subscriptions[0]?.endsAt;
              return (
                <li key={seller.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="font-semibold">{seller.store?.name ?? "Sem loja"}</span>
                  <span className="text-muted-foreground">
                    {endsAt ? `VIP ativo até ${formatDate(endsAt)}` : "VIP ativo"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {result.pageCount > 1 ? (
        <Pagination
          ariaLabel="Paginação de lojas para VIP"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
          summary={<>{result.total} loja(s)</>}
        />
      ) : null}
    </AdminCard>
  );
}
