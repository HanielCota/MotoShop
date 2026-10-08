import type { Route } from "next";
import { TicketPercent } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DesignSelect } from "@/components/ui/design-select";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatMoneyInCents } from "@/lib/format";
import { setSellerCouponActiveAction } from "@/modules/coupons/actions/coupon-actions";
import { CouponForm } from "@/modules/coupons/components/coupon-form";
import { listSellerCoupons } from "@/modules/coupons/queries/coupons";
import { loadCouponSearchParams, serializeCouponSearchParams } from "@/modules/coupons/search-params";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const basePath = "/seller/coupons";

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
        <CardTitle>
          <h2 className="text-lg">Cupons da loja</h2>
        </CardTitle>
        <CardDescription>
          {result.total} {result.total === 1 ? "cupom" : "cupons"} · descontos financiados pela sua loja.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CouponForm ownerType="SELLER" />
        <form
          className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_200px_auto] lg:items-end"
          method="get"
          action={basePath}
        >
          <label className="flex flex-col gap-1 text-sm font-medium">
            Buscar cupom
            <Input name="couponQ" defaultValue={params.couponQ ?? ""} placeholder="Código" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Status
            <DesignSelect aria-label="Status" name="couponActive" defaultValue={params.couponActive}>
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Ativos</option>
              <option value="INACTIVE">Inativos</option>
            </DesignSelect>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Vigência
            <DesignSelect aria-label="Vigência" name="couponValidity" defaultValue={params.couponValidity}>
              <option value="ALL">Todas</option>
              <option value="CURRENT">Vigentes</option>
              <option value="UPCOMING">Futuros</option>
              <option value="EXPIRED">Expirados</option>
            </DesignSelect>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Ordenação
            <DesignSelect aria-label="Ordenação" name="couponSort" defaultValue={params.couponSort}>
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
              <option value="ends_soonest">Validade mais próxima</option>
              <option value="code_asc">Código A–Z</option>
            </DesignSelect>
          </label>
          <Button type="submit">Filtrar</Button>
        </form>
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Cupons da loja</caption>
              <thead className="text-muted-foreground border-b text-xs">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Código
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Desconto
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Uso
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Validade
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {result.coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td className="py-3 pr-3 font-semibold">{coupon.code}</td>
                    <td className="py-3 pr-3 tabular-nums">
                      {coupon.discountType === "PERCENTAGE"
                        ? `${(coupon.percentageBps ?? 0) / 100}%`
                        : formatMoneyInCents(coupon.fixedAmountInCents ?? 0)}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge variant={coupon.active ? "success" : "neutral"}>
                        {coupon.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="py-3 pr-3 tabular-nums">
                      {coupon._count.redemptions}
                      {coupon.globalUsageLimit !== null ? `/${coupon.globalUsageLimit}` : ""}
                    </td>
                    <td className="text-muted-foreground py-3 pr-3">
                      {coupon.endsAt ? `até ${formatDate(coupon.endsAt)}` : "Sem prazo"}
                    </td>
                    <td className="py-3 text-right">
                      <form action={setSellerCouponActiveAction.bind(null, coupon.id, !coupon.active)}>
                        <Button type="submit" variant="outline" size="sm">
                          {coupon.active ? "Desativar" : "Ativar"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
