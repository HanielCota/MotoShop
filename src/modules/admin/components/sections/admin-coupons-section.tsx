import { TicketPercent } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatMoneyInCents } from "@/lib/format";
import { setMarketplaceCouponActiveAction } from "@/modules/coupons/actions/coupon-actions";
import { CouponForm } from "@/modules/coupons/components/coupon-form";
import { listMarketplaceCoupons } from "@/modules/coupons/queries/coupons";
import { loadCouponSearchParams } from "@/modules/coupons/search-params";

import { adminHref } from "../../admin-href";
import { AdminCard, AdminFilterForm, AdminTable, cellClassName, FilterSelect, FilterText } from "../admin-ui";
import type { AdminSectionProps } from "./types";

const activeOptions = [
  { value: "ALL", label: "Todos" },
  { value: "ACTIVE", label: "Ativos" },
  { value: "INACTIVE", label: "Inativos" },
];

const validityOptions = [
  { value: "ALL", label: "Todas" },
  { value: "CURRENT", label: "Vigentes" },
  { value: "UPCOMING", label: "Futuros" },
  { value: "EXPIRED", label: "Expirados" },
];

const sortOptions = [
  { value: "newest", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "ends_soonest", label: "Validade mais próxima" },
  { value: "code_asc", label: "Código A–Z" },
];

export async function AdminCouponsSection({ searchParams }: AdminSectionProps) {
  const params = await loadCouponSearchParams(searchParams);
  const result = await listMarketplaceCoupons({
    query: params.couponQ,
    active: params.couponActive,
    validity: params.couponValidity,
    sort: params.couponSort,
    page: params.couponPage,
  });
  const pageHref = (page: number) => adminHref("coupons", { ...params, couponPage: page }, { couponSort: "newest" });

  return (
    <AdminCard
      id="admin-coupons"
      title="Cupons do marketplace"
      description="Crie descontos globais financiados pelo Moto Shop, em percentual ou em reais."
    >
      <CouponForm ownerType="MARKETPLACE" />
      <AdminFilterForm resetHref={adminHref("coupons", {})} label="Filtrar cupons">
        <FilterText label="Buscar cupom" name="couponQ" value={params.couponQ} placeholder="Código" />
        <FilterSelect label="Status" name="couponActive" value={params.couponActive} options={activeOptions} />
        <FilterSelect label="Vigência" name="couponValidity" value={params.couponValidity} options={validityOptions} />
        <FilterSelect label="Ordenação" name="couponSort" value={params.couponSort} options={sortOptions} />
      </AdminFilterForm>
      {result.coupons.length === 0 ? (
        <EmptyState
          icon={TicketPercent}
          title="Nenhum cupom encontrado"
          description="Crie um cupom acima ou ajuste os filtros."
        />
      ) : (
        <AdminTable
          caption="Cupons do marketplace"
          columns={["Código", "Desconto", "Status", "Uso", "Validade", "Ação"]}
        >
          {result.coupons.map((coupon) => (
            <tr key={coupon.id}>
              <td className={`${cellClassName} font-semibold`}>{coupon.code}</td>
              <td className={`${cellClassName} whitespace-nowrap`}>
                {coupon.discountType === "PERCENTAGE"
                  ? `${(coupon.percentageBps ?? 0) / 100}%`
                  : formatMoneyInCents(coupon.fixedAmountInCents ?? 0)}
              </td>
              <td className={cellClassName}>
                <Badge variant={coupon.active ? "success" : "neutral"}>{coupon.active ? "Ativo" : "Inativo"}</Badge>
              </td>
              <td className={`${cellClassName} tabular-nums`}>
                {coupon._count.redemptions}
                {coupon.globalUsageLimit !== null ? `/${coupon.globalUsageLimit}` : ""}
              </td>
              <td className={`${cellClassName} text-muted-foreground whitespace-nowrap`}>
                {coupon.endsAt ? `até ${formatDate(coupon.endsAt)}` : "Sem prazo"}
              </td>
              <td className={cellClassName}>
                <form action={setMarketplaceCouponActiveAction.bind(null, coupon.id, !coupon.active)}>
                  <button type="submit" className="text-brand-text text-xs font-medium underline underline-offset-4">
                    {coupon.active ? "Desativar" : "Ativar"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
      {result.pageCount > 1 ? (
        <Pagination
          ariaLabel="Paginação de cupons do marketplace"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
          summary={<>{result.total} cupom(ns)</>}
        />
      ) : null}
    </AdminCard>
  );
}
