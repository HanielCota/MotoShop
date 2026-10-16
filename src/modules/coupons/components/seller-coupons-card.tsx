import type { Route } from "next";
import { TicketPercent } from "lucide-react";

import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, tableCellClassName } from "@/components/ui/table";
import { FilterForm, FilterSelect, FilterText } from "@/components/ui/filter-form";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatMoneyInCents, formatPercentFromBps } from "@/lib/format";
import {
  setSellerCouponActiveAction,
  setSellerCouponProductPageAction,
} from "@/modules/coupons/actions/coupon-actions";
import { CouponForm } from "@/modules/coupons/components/coupon-form";
import { listSellerCoupons } from "@/modules/coupons/queries/coupons";
import { loadCouponSearchParams, serializeCouponSearchParams } from "@/modules/coupons/search-params";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const basePath = "/seller/coupons";
const couponActiveOptions = [
  { value: "ALL", label: "Todos" },
  { value: "ACTIVE", label: "Ativos" },
  { value: "INACTIVE", label: "Inativos" },
];
const couponValidityOptions = [
  { value: "ALL", label: "Todas" },
  { value: "CURRENT", label: "Vigentes" },
  { value: "UPCOMING", label: "Futuros" },
  { value: "EXPIRED", label: "Expirados" },
];
const couponSortOptions = [
  { value: "newest", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "ends_soonest", label: "Validade mais próxima" },
  { value: "code_asc", label: "Código A–Z" },
];

export async function SellerCouponsCard({ sellerId, searchParams }: { sellerId: string; searchParams: SearchParams }) {
  const params = await loadCouponSearchParams(searchParams);
  const result = await listSellerCoupons(sellerId, {
    query: params.couponQ,
    active: params.couponActive,
    validity: params.couponValidity,
    sort: params.couponSort,
    page: params.couponPage,
  });
  const hasFilters = Boolean(params.couponQ || params.couponActive !== "ALL" || params.couponValidity !== "ALL");
  const pageHref = (page: number) => serializeCouponSearchParams(basePath, { ...params, couponPage: page }) as Route;

  return (
    <Card id="seller-coupons" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Cupons da loja</CardTitle>
        <CardDescription>
          {result.total} {result.total === 1 ? "cupom" : "cupons"} · descontos financiados pela sua loja.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CouponForm ownerType="SELLER" />
        <FilterForm resetHref={basePath} action={basePath} label="Filtrar cupons">
          <FilterText label="Buscar cupom" name="couponQ" value={params.couponQ} placeholder="Código" />
          <FilterSelect label="Status" name="couponActive" value={params.couponActive} options={couponActiveOptions} />
          <FilterSelect
            label="Vigência"
            name="couponValidity"
            value={params.couponValidity}
            options={couponValidityOptions}
          />
          <FilterSelect label="Ordenação" name="couponSort" value={params.couponSort} options={couponSortOptions} />
        </FilterForm>
        {result.coupons.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={TicketPercent}
            title={hasFilters ? "Nenhum cupom encontrado" : "Nenhum cupom criado"}
            description={
              hasFilters
                ? "Ajuste ou limpe os filtros para ver outros cupons."
                : "Crie um cupom acima para oferecer descontos financiados pela sua loja."
            }
            action={hasFilters ? { label: "Limpar filtros", href: basePath } : undefined}
          />
        ) : (
          <>
            {/* Small screens: stacked cards so the action is always visible without scrolling sideways. */}
            <ul className="divide-border divide-y md:hidden" aria-label="Cupons da loja">
              {result.coupons.map((coupon) => (
                <li key={coupon.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold break-all">{coupon.code}</p>
                      <p className="text-sm tabular-nums">{couponDiscountLabel(coupon)} de desconto</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Badge variant={coupon.active ? "success" : "neutral"}>
                        {coupon.active ? "Ativo" : "Inativo"}
                      </Badge>
                      {coupon.showOnProductPage ? <Badge variant="success">No produto</Badge> : null}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {couponUsageLabel(coupon)} · {coupon.endsAt ? `até ${formatDate(coupon.endsAt)}` : "Sem prazo"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <CouponProductPageToggle couponId={coupon.id} shown={coupon.showOnProductPage} />
                    <CouponActiveToggle couponId={coupon.id} code={coupon.code} active={coupon.active} />
                  </div>
                </li>
              ))}
            </ul>
            {/* Mesmo cabeçalho das tabelas do Admin (DS-16). */}
            <DataTable
              caption="Cupons da loja"
              columns={["Código", "Desconto", "Status", "Uso", "Validade", "Ações"]}
              minWidth="min-w-[640px]"
              className="hidden md:block"
            >
              {result.coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td className={`${tableCellClassName} font-semibold`}>{coupon.code}</td>
                  <td className={`${tableCellClassName} tabular-nums`}>{couponDiscountLabel(coupon)}</td>
                  <td className={tableCellClassName}>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={coupon.active ? "success" : "neutral"}>
                        {coupon.active ? "Ativo" : "Inativo"}
                      </Badge>
                      {coupon.showOnProductPage ? <Badge variant="success">No produto</Badge> : null}
                    </div>
                  </td>
                  <td className={`${tableCellClassName} tabular-nums`}>{couponUsageLabel(coupon)}</td>
                  <td className={`${tableCellClassName} text-muted-foreground`}>
                    {coupon.endsAt ? `até ${formatDate(coupon.endsAt)}` : "Sem prazo"}
                  </td>
                  <td className={tableCellClassName}>
                    <div className="flex flex-wrap gap-2">
                      <CouponProductPageToggle couponId={coupon.id} shown={coupon.showOnProductPage} />
                      <CouponActiveToggle couponId={coupon.id} code={coupon.code} active={coupon.active} />
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </>
        )}
        <Pagination
          ariaLabel="Paginação de cupons da loja"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
        />
      </CardContent>
    </Card>
  );
}

type CouponSummary = {
  discountType: string;
  percentageBps: number | null;
  fixedAmountInCents: number | null;
  globalUsageLimit: number | null;
  _count: { redemptions: number };
};

function couponDiscountLabel(coupon: CouponSummary): string {
  return coupon.discountType === "PERCENTAGE"
    ? formatPercentFromBps(coupon.percentageBps ?? 0)
    : formatMoneyInCents(coupon.fixedAmountInCents ?? 0);
}

function couponUsageLabel(coupon: CouponSummary): string {
  const used = coupon._count.redemptions;
  return coupon.globalUsageLimit !== null
    ? `${used}/${coupon.globalUsageLimit} usos`
    : `${used} ${used === 1 ? "uso" : "usos"}`;
}

function CouponActiveToggle({ couponId, code, active }: { couponId: string; code: string; active: boolean }) {
  if (active) {
    return (
      <ConfirmDialog
        trigger={
          <Button type="button" variant="outline" size="sm">
            Desativar
          </Button>
        }
        title={`Desativar o cupom ${code}?`}
        description="Clientes deixam de poder usar o cupom até você reativar."
        confirmLabel="Desativar"
        tone="destructive"
        onConfirm={setSellerCouponActiveAction.bind(null, couponId, false)}
      />
    );
  }

  return (
    <ActionForm action={setSellerCouponActiveAction.bind(null, couponId, true)}>
      <Button type="submit" variant="outline" size="sm">
        Ativar
      </Button>
    </ActionForm>
  );
}

function CouponProductPageToggle({ couponId, shown }: { couponId: string; shown: boolean }) {
  return (
    <ActionForm action={setSellerCouponProductPageAction.bind(null, couponId, !shown)}>
      <Button type="submit" variant="outline" size="sm">
        {shown ? "Ocultar do produto" : "Mostrar no produto"}
      </Button>
    </ActionForm>
  );
}
