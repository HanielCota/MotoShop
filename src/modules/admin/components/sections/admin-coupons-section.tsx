import { TicketPercent } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatMoneyInCents, formatCount } from "@/lib/format";
import { couponValidityLabel } from "@/modules/coupons/domain/coupon-validity";
import { setMarketplaceCouponActiveAction } from "@/modules/coupons/actions/coupon-actions";
import { CouponForm } from "@/modules/coupons/components/coupon-form";
import { couponKindLabels, getCouponKind, isSellerFundedCampaign } from "@/modules/coupons/domain/coupon-kind";
import { listCouponParticipants } from "@/modules/coupons/queries/coupon-participation";
import { getMarketplaceCoupon, listMarketplaceCoupons } from "@/modules/coupons/queries/coupons";
import { isRecordId } from "@/shared/validation/record-id";
import { loadCouponSearchParams } from "@/modules/coupons/search-params";

import { adminHref } from "../../admin-href";
import { clampAdminPage } from "../../search-params";
import {
  AdminCard,
  AdminFilterForm,
  AdminList,
  AdminTable,
  cellClassName,
  FilterSelect,
  FilterText,
} from "../admin-ui";
import type { AdminSectionProps } from "./types";
import { buttonVariants } from "@/components/ui/button";

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
  // oxlint-disable-next-line react/purity -- Server Component: it renders once per request, on the server, so the date cannot drift between renders.
  const now = new Date();
  const result = await listMarketplaceCoupons({
    // Os parâmetros de cupom são compartilhados com a Central do Lojista; o Admin limita página e NUL aqui.
    query: params.couponQ?.replaceAll(String.fromCharCode(0), "") ?? null,
    active: params.couponActive,
    validity: params.couponValidity,
    sort: params.couponSort,
    page: clampAdminPage(params.couponPage),
  });
  const pageHref = (page: number) => adminHref("coupons", { ...params, couponPage: page }, { couponSort: "newest" });
  const participantsHref = (campaignId: string) =>
    `${adminHref("coupons", { ...params, campaignId }, { couponSort: "newest" })}#campaign-participants` as Route;
  const campaign = await loadCampaignParticipants(params.campaignId);

  return (
    <AdminCard
      id="admin-coupons"
      title="Cupons do marketplace"
      description="Crie cupons pagos pelo Moto Shop ou campanhas em que as lojas aderem e pagam o desconto."
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
        <>
          {/* No celular, cada cupom vira um cartão com as ações à vista (BUG-024). */}
          <div className="md:hidden">
            <AdminList label="Cupons do marketplace">
              {result.coupons.map((coupon) => (
                <li key={coupon.id} className="flex flex-col gap-1 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold break-all">{coupon.code}</p>
                    <Badge variant={coupon.active ? "success" : "neutral"}>{coupon.active ? "Ativo" : "Inativo"}</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {couponKindLabels[getCouponKind(coupon)]} · {couponDiscountLabel(coupon)} de desconto
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {couponUsageLabel(coupon)} usos · {couponValidityLabel(coupon, now)}
                  </p>
                  <CouponActions coupon={coupon} participantsHref={participantsHref(coupon.id)} />
                </li>
              ))}
            </AdminList>
          </div>
          <AdminTable
            caption="Cupons do marketplace"
            columns={["Código", "Tipo", "Desconto", "Status", "Uso", "Validade", "Ação"]}
            className="hidden md:block"
          >
            {result.coupons.map((coupon) => (
              <tr key={coupon.id}>
                <td className={`${cellClassName} font-semibold`}>{coupon.code}</td>
                <td className={`${cellClassName} whitespace-nowrap`}>{couponKindLabels[getCouponKind(coupon)]}</td>
                <td className={`${cellClassName} whitespace-nowrap`}>{couponDiscountLabel(coupon)}</td>
                <td className={cellClassName}>
                  <Badge variant={coupon.active ? "success" : "neutral"}>{coupon.active ? "Ativo" : "Inativo"}</Badge>
                </td>
                <td className={`${cellClassName} tabular-nums`}>{couponUsageLabel(coupon)}</td>
                <td className={`${cellClassName} text-muted-foreground whitespace-nowrap`}>
                  {couponValidityLabel(coupon, now)}
                </td>
                <td className={cellClassName}>
                  <CouponActions coupon={coupon} participantsHref={participantsHref(coupon.id)} />
                </td>
              </tr>
            ))}
          </AdminTable>
        </>
      )}
      {campaign ? <CampaignParticipants code={campaign.code} participants={campaign.participants} /> : null}
      {result.pageCount > 1 ? (
        <Pagination
          ariaLabel="Paginação de cupons do marketplace"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
          summary={<>{formatCount(result.total, "cupom", "cupons")}</>}
        />
      ) : null}
    </AdminCard>
  );
}

type MarketplaceCouponRow = Awaited<ReturnType<typeof listMarketplaceCoupons>>["coupons"][number];

function couponDiscountLabel(coupon: MarketplaceCouponRow) {
  return coupon.discountType === "PERCENTAGE"
    ? `${(coupon.percentageBps ?? 0) / 100}%`
    : formatMoneyInCents(coupon.fixedAmountInCents ?? 0);
}

function couponUsageLabel(coupon: MarketplaceCouponRow) {
  return `${coupon._count.redemptions}${coupon.globalUsageLimit !== null ? `/${coupon.globalUsageLimit}` : ""}`;
}

function CouponActions({ coupon, participantsHref }: { coupon: MarketplaceCouponRow; participantsHref: Route }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {isSellerFundedCampaign(coupon) ? (
        <Link href={participantsHref} className={buttonVariants({ variant: "link", size: "link-xs" })}>
          Ver lojas ({coupon._count.sellerParticipations})
        </Link>
      ) : null}
      {coupon.active ? (
        <ConfirmDialog
          trigger={
            <button type="button" className={buttonVariants({ variant: "link", size: "link-xs" })}>
              Desativar
            </button>
          }
          title={`Desativar o cupom ${coupon.code}?`}
          description="Clientes deixam de poder usar o cupom até ele ser reativado."
          confirmLabel="Desativar"
          tone="destructive"
          onConfirm={setMarketplaceCouponActiveAction.bind(null, coupon.id, false)}
        />
      ) : (
        <ActionForm action={setMarketplaceCouponActiveAction.bind(null, coupon.id, true)}>
          <button type="submit" className={buttonVariants({ variant: "link", size: "link-xs" })}>
            Ativar
          </button>
        </ActionForm>
      )}
    </div>
  );
}

async function loadCampaignParticipants(campaignId: string | null) {
  if (!campaignId || !isRecordId(campaignId)) return null;
  const coupon = await getMarketplaceCoupon(campaignId);
  if (!coupon || !isSellerFundedCampaign(coupon)) return null;
  return { code: coupon.code, participants: await listCouponParticipants(coupon.id) };
}

function CampaignParticipants({
  code,
  participants,
}: {
  code: string;
  participants: Awaited<ReturnType<typeof listCouponParticipants>>;
}) {
  return (
    <section id="campaign-participants" aria-labelledby="campaign-participants-title" className="space-y-3">
      <h3 id="campaign-participants-title" className="text-sm font-semibold">
        Lojas na campanha {code}
      </h3>
      {participants.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma loja aderiu a esta campanha ainda.</p>
      ) : (
        <AdminTable caption={`Lojas na campanha ${code}`} columns={["Loja", "Entrou em", "Situação"]}>
          {participants.map((participant) => (
            <tr key={participant.sellerId}>
              <td className={`${cellClassName} font-medium`}>{participant.seller.store?.name ?? "Loja sem nome"}</td>
              <td className={`${cellClassName} whitespace-nowrap`}>{formatDate(participant.joinedAt)}</td>
              <td className={cellClassName}>
                {participant.leftAt ? (
                  <span className="text-muted-foreground">Saiu em {formatDate(participant.leftAt)}</span>
                ) : (
                  <Badge variant="success">Participando</Badge>
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </section>
  );
}
