import { Store } from "lucide-react";

import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatCount } from "@/lib/format";
import {
  approveSellerAction,
  reactivateSellerAction,
  rejectSellerAction,
  suspendSellerAction,
} from "@/modules/sellers/actions/admin-seller-actions";
import { listSellersForAdmin } from "@/modules/sellers/queries/sellers";
import { getStatusLabel } from "@/shared/presentation/status-labels";

import { adminHref } from "../../admin-href";
import { adminSellerStatusValues, loadAdminSellerSearchParams } from "../../search-params";
import { AdminCard, AdminFilterForm, AdminList, FilterSelect, FilterText, newestFirstSortOptions } from "../admin-ui";
import { SellerCommissionForm } from "../seller-commission-form";
import type { AdminSectionProps } from "./types";

const sellerStatusOptions = adminSellerStatusValues.map((status) => ({
  value: status,
  label: status === "ALL" ? "Todos" : getStatusLabel("seller", status),
}));

export async function AdminSellersSection({ searchParams }: AdminSectionProps) {
  const params = await loadAdminSellerSearchParams(searchParams);
  const result = await listSellersForAdmin({
    status: params.sellerStatus,
    q: params.sellerQ,
    sort: params.sellerSort,
    page: params.sellerPage,
  });
  const pageHref = (page: number) => adminHref("sellers", { ...params, sellerPage: page }, { sellerSort: "newest" });

  return (
    <AdminCard
      id="admin-sellers"
      title="Solicitações de lojistas"
      description="Aprove lojas antes de liberar a operação do catálogo."
    >
      <AdminFilterForm resetHref={adminHref("sellers", {})} label="Filtrar lojistas">
        <FilterText label="Buscar lojista" name="sellerQ" value={params.sellerQ} placeholder="Loja, nome ou e-mail" />
        <FilterSelect
          label="Status do lojista"
          name="sellerStatus"
          value={params.sellerStatus}
          options={sellerStatusOptions}
        />
        <FilterSelect label="Ordenação" name="sellerSort" value={params.sellerSort} options={newestFirstSortOptions} />
      </AdminFilterForm>
      {result.sellers.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Nenhum lojista encontrado"
          description="Ajuste os filtros ou aguarde novos cadastros de lojas."
        />
      ) : (
        <AdminList label="Lojistas">
          {result.sellers.map((seller) => (
            <li
              key={seller.id}
              data-testid={`seller-review-${seller.id}`}
              className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{seller.store?.name ?? "Sem loja"}</h3>
                  <StatusBadge domain="seller" status={seller.status} />
                </div>
                <p className="text-muted-foreground text-sm break-all">
                  {seller.members[0]?.user.email ?? "Sem responsável"} ·{" "}
                  {formatCount(seller._count.products, "produto", "produtos")} · desde {formatDate(seller.createdAt)}
                </p>
                <SellerCommissionForm sellerId={seller.id} commissionBpsOverride={seller.commissionBpsOverride} />
              </div>
              {seller.status === "PENDING" ? (
                <div className="flex shrink-0 gap-2">
                  <ConfirmDialog
                    trigger={
                      <Button type="button" size="sm">
                        Aprovar
                      </Button>
                    }
                    title={`Aprovar a ${seller.store?.name ?? "loja"}?`}
                    description="A loja passa a cadastrar produtos e enviar para aprovação."
                    confirmLabel="Aprovar loja"
                    onConfirm={approveSellerAction.bind(null, seller.id)}
                  />
                  <ConfirmDialog
                    trigger={
                      <Button type="button" variant="outline" size="sm">
                        Recusar
                      </Button>
                    }
                    title={`Recusar o cadastro da ${seller.store?.name ?? "loja"}?`}
                    description="O lojista vê este motivo na Central do Lojista."
                    reason={{
                      label: "Motivo da recusa",
                      required: true,
                      placeholder: "Ex.: CNPJ não confere com o nome da loja.",
                      maxLength: 1000,
                    }}
                    confirmLabel="Recusar loja"
                    tone="destructive"
                    onConfirm={rejectSellerAction.bind(null, seller.id)}
                  />
                </div>
              ) : seller.status === "SUSPENDED" ? (
                <ActionForm action={reactivateSellerAction.bind(null, seller.id)} className="shrink-0">
                  <Button type="submit" size="sm">
                    Reativar
                  </Button>
                </ActionForm>
              ) : seller.status === "APPROVED" || seller.status === "ACTIVE" ? (
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="outline" size="sm" className="shrink-0">
                      Suspender
                    </Button>
                  }
                  title={`Suspender a ${seller.store?.name ?? "loja"}?`}
                  description="Os produtos saem da vitrine e a equipe perde o acesso à Central do Lojista até a loja ser reativada."
                  confirmLabel="Suspender loja"
                  tone="destructive"
                  onConfirm={suspendSellerAction.bind(null, seller.id)}
                />
              ) : null}
            </li>
          ))}
        </AdminList>
      )}
      {result.pageCount > 1 ? (
        <Pagination
          ariaLabel="Paginação de lojistas"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
          summary={<>{formatCount(result.total, "lojista", "lojistas")}</>}
        />
      ) : null}
    </AdminCard>
  );
}
