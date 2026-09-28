import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { DesignSelect } from "@/components/ui/design-select";
import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CategoryForm,
  BrandForm,
  MotorcycleFitmentForm,
  MotorcycleManufacturerForm,
  MotorcycleModelForm,
} from "@/modules/catalog/components/catalog-admin-forms";
import {
  toggleBrandAction,
  toggleCategoryAction,
  toggleMotorcycleManufacturerAction,
  toggleMotorcycleModelAction,
} from "@/modules/catalog/actions/admin-catalog-actions";
import { getAdminCatalogData } from "@/modules/catalog/queries/admin-catalog";
import { listAuditLogsForAdmin } from "@/modules/admin/queries/audit-logs";
import { listSellerOrdersForAdmin } from "@/modules/admin/queries/orders";
import { retryWebhookEventAction } from "@/modules/admin/actions/webhook-actions";
import { CommissionForm } from "@/modules/admin/components/commission-form";
import { SellerCommissionForm } from "@/modules/admin/components/seller-commission-form";
import { IntegrationReadiness } from "@/modules/admin/components/integration-readiness";
import { getMarketplaceConfiguration } from "@/modules/admin/queries/marketplace-configuration";
import { listNotificationDeliveriesForAdmin } from "@/modules/admin/queries/notification-deliveries";
import { listWebhookEventsForAdmin } from "@/modules/admin/queries/webhook-events";
import { loadAdminSearchParams } from "@/modules/admin/search-params";
import { CouponForm } from "@/modules/coupons/components/coupon-form";
import { listMarketplaceCoupons } from "@/modules/coupons/queries/coupons";
import { setMarketplaceCouponActiveAction } from "@/modules/coupons/actions/coupon-actions";
import { loadCouponSearchParams } from "@/modules/coupons/search-params";
import { ProductStatusActions } from "@/modules/products/components/product-status-actions";
import { listProductReviewQueue } from "@/modules/products/queries/products";
import { DisputeStatusActions } from "@/modules/disputes/components/dispute-status-actions";
import { listDisputesForAdmin } from "@/modules/disputes/queries/admin-disputes";
import { CancellationStatusActions } from "@/modules/returns/components/cancellation-status-actions";
import { ReturnStatusActions } from "@/modules/returns/components/return-status-actions";
import { listCancellationRequestsForAdmin } from "@/modules/returns/queries/admin-cancellations";
import { listReturnRequestsForAdmin } from "@/modules/returns/queries/admin-returns";
import {
  approveSellerAction,
  reactivateSellerAction,
  rejectSellerAction,
  suspendSellerAction,
} from "@/modules/sellers/actions/admin-seller-actions";
import { listSellerOptionsForAdmin, listSellersForAdmin } from "@/modules/sellers/queries/sellers";
import { VipSubscriptionForm } from "@/modules/subscriptions/components/vip-subscription-form";
import { formatMoneyInCents } from "@/lib/utils";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

const returnStatusLabels: Record<string, string> = {
  REQUESTED: "Solicitada",
  UNDER_REVIEW: "Em análise",
  APPROVED: "Aprovada",
  WAITING_RETURN: "Aguardando retorno",
  RETURNED: "Recebida",
};

const returnReasonLabels: Record<string, string> = {
  DAMAGED: "Produto danificado",
  WRONG_ITEM: "Item diferente do pedido",
  NOT_AS_DESCRIBED: "Diferente do anúncio",
  REGRET: "Desistência",
  OTHER: "Outro motivo",
};

const adminOrderStatusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  PROCESSING: "Em processamento",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLATION_REQUESTED: "Cancelamento em análise",
  CANCELLED: "Cancelado",
};

const shipmentStatusLabels: Record<string, string> = {
  PENDING: "Aguardando envio",
  READY_TO_SHIP: "Etiqueta pronta",
  SHIPPED: "Postado",
  IN_TRANSIT: "Em trânsito",
  DELIVERED: "Entregue",
  EXCEPTION: "Problema no envio",
  CANCELLED: "Envio cancelado",
};

const webhookStatusLabels: Record<string, string> = {
  RECEIVED: "Recebido",
  PROCESSING: "Processando",
  PROCESSED: "Processado",
  FAILED: "Falhou",
};

const notificationStatusLabels: Record<string, string> = {
  PROCESSING: "Processando",
  SENT: "Enviado",
  FAILED: "Falhou",
};

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await loadAdminSearchParams(searchParams);
  const couponParams = await loadCouponSearchParams(searchParams);
  const [
    sellerResult,
    sellerOptions,
    productResult,
    returnResult,
    cancellationResult,
    disputeResult,
    couponResult,
    catalog,
    adminOrderResult,
    auditResult,
    webhookResult,
    notificationResult,
    marketplaceConfiguration,
  ] = await Promise.all([
    listSellersForAdmin({
      status: params.sellerStatus,
      q: params.sellerQ,
      sort: params.sellerSort,
      page: params.sellerPage,
    }),
    listSellerOptionsForAdmin(),
    listProductReviewQueue({
      status: params.productReviewStatus,
      q: params.productReviewQ,
      categoryId: params.productReviewCategoryId,
      brandId: params.productReviewBrandId,
      sellerId: params.productReviewSellerId,
      from: params.productReviewFrom,
      to: params.productReviewTo,
      sort: params.productReviewSort,
      page: params.productReviewPage,
    }),
    listReturnRequestsForAdmin({
      status: params.returnStatus,
      q: params.returnQ,
      sellerId: params.returnSellerId,
      from: params.returnFrom,
      to: params.returnTo,
      sort: params.returnSort,
      page: params.returnPage,
    }),
    listCancellationRequestsForAdmin({
      status: params.cancellationStatus,
      q: params.cancellationQ,
      sellerId: params.cancellationSellerId,
      from: params.cancellationFrom,
      to: params.cancellationTo,
      sort: params.cancellationSort,
      page: params.cancellationPage,
    }),
    listDisputesForAdmin({
      status: params.disputeStatus,
      q: params.disputeQ,
      sellerId: params.disputeSellerId,
      from: params.disputeFrom,
      to: params.disputeTo,
      sort: params.disputeSort,
      page: params.disputePage,
    }),
    listMarketplaceCoupons({
      query: couponParams.couponQ,
      active: couponParams.couponActive,
      validity: couponParams.couponValidity,
      sort: couponParams.couponSort,
      page: couponParams.couponPage,
    }),
    getAdminCatalogData(),
    listSellerOrdersForAdmin({
      status: params.adminOrderStatus,
      shipmentStatus: params.adminOrderShipmentStatus,
      q: params.adminOrderQ,
      sellerId: params.adminOrderSellerId,
      from: params.adminOrderFrom,
      to: params.adminOrderTo,
      sort: params.adminOrderSort,
      page: params.adminOrderPage,
    }),
    listAuditLogsForAdmin({
      action: params.auditAction,
      entityType: params.auditEntityType,
      q: params.auditQ,
      actorQ: params.auditActorQ,
      from: params.auditFrom,
      to: params.auditTo,
      sort: params.auditSort,
      page: params.auditPage,
    }),
    listWebhookEventsForAdmin({
      status: params.webhookStatus,
      q: params.webhookQ,
      provider: params.webhookProvider,
      from: params.webhookFrom,
      to: params.webhookTo,
      sort: params.webhookSort,
      page: params.webhookPage,
    }),
    listNotificationDeliveriesForAdmin({
      status: params.notificationStatus,
      q: params.notificationQ,
      kind: params.notificationKind,
      from: params.notificationFrom,
      to: params.notificationTo,
      sort: params.notificationSort,
      page: params.notificationPage,
    }),
    getMarketplaceConfiguration(),
  ]);
  const sellers = sellerResult.sellers;
  const products = productResult.products;
  const marketplaceCoupons = couponResult.coupons;
  const returnRequests = returnResult.requests;
  const cancellationRequests = cancellationResult.requests;
  const disputes = disputeResult.disputes;

  function adminHref(input: {
    sellerPage?: number;
    productReviewPage?: number;
    adminOrderPage?: number;
    auditPage?: number;
    returnPage?: number;
    cancellationPage?: number;
    disputePage?: number;
    couponPage?: number;
    webhookPage?: number;
    notificationPage?: number;
  }): Route {
    const query = new URLSearchParams();
    if (params.sellerStatus !== "ALL") query.set("sellerStatus", params.sellerStatus);
    if (params.sellerQ) query.set("sellerQ", params.sellerQ);
    if (params.sellerSort !== "newest") query.set("sellerSort", params.sellerSort);
    if (params.productReviewStatus !== "ALL") query.set("productReviewStatus", params.productReviewStatus);
    if (params.productReviewQ) query.set("productReviewQ", params.productReviewQ);
    if (params.productReviewCategoryId) query.set("productReviewCategoryId", params.productReviewCategoryId);
    if (params.productReviewBrandId) query.set("productReviewBrandId", params.productReviewBrandId);
    if (params.productReviewSellerId) query.set("productReviewSellerId", params.productReviewSellerId);
    if (params.adminOrderStatus !== "ALL") query.set("adminOrderStatus", params.adminOrderStatus);
    if (params.adminOrderShipmentStatus !== "ALL")
      query.set("adminOrderShipmentStatus", params.adminOrderShipmentStatus);
    if (params.adminOrderQ) query.set("adminOrderQ", params.adminOrderQ);
    if (params.adminOrderSellerId) query.set("adminOrderSellerId", params.adminOrderSellerId);
    if (params.adminOrderFrom) query.set("adminOrderFrom", params.adminOrderFrom);
    if (params.adminOrderTo) query.set("adminOrderTo", params.adminOrderTo);
    if (params.adminOrderSort !== "newest") query.set("adminOrderSort", params.adminOrderSort);
    if (params.productReviewFrom) query.set("productReviewFrom", params.productReviewFrom);
    if (params.productReviewTo) query.set("productReviewTo", params.productReviewTo);
    if (params.productReviewSort !== "oldest") query.set("productReviewSort", params.productReviewSort);
    if (params.auditAction) query.set("auditAction", params.auditAction);
    if (params.auditEntityType) query.set("auditEntityType", params.auditEntityType);
    if (params.auditQ) query.set("auditQ", params.auditQ);
    if (params.auditActorQ) query.set("auditActorQ", params.auditActorQ);
    if (params.auditFrom) query.set("auditFrom", params.auditFrom);
    if (params.auditTo) query.set("auditTo", params.auditTo);
    if (couponParams.couponSort !== "newest") query.set("couponSort", couponParams.couponSort);
    if (params.auditSort !== "newest") query.set("auditSort", params.auditSort);
    if (input.sellerPage && input.sellerPage > 1) query.set("sellerPage", String(input.sellerPage));
    if (input.productReviewPage && input.productReviewPage > 1)
      query.set("productReviewPage", String(input.productReviewPage));
    if (input.adminOrderPage && input.adminOrderPage > 1) query.set("adminOrderPage", String(input.adminOrderPage));
    if (input.auditPage && input.auditPage > 1) query.set("auditPage", String(input.auditPage));
    if (params.webhookStatus) query.set("webhookStatus", params.webhookStatus);
    if (params.webhookQ) query.set("webhookQ", params.webhookQ);
    if (params.webhookProvider) query.set("webhookProvider", params.webhookProvider);
    if (params.webhookFrom) query.set("webhookFrom", params.webhookFrom);
    if (params.webhookTo) query.set("webhookTo", params.webhookTo);
    if (params.webhookSort !== "newest") query.set("webhookSort", params.webhookSort);
    if (input.webhookPage && input.webhookPage > 1) query.set("webhookPage", String(input.webhookPage));
    if (params.notificationStatus) query.set("notificationStatus", params.notificationStatus);
    if (params.notificationQ) query.set("notificationQ", params.notificationQ);
    if (params.notificationKind) query.set("notificationKind", params.notificationKind);
    if (params.notificationFrom) query.set("notificationFrom", params.notificationFrom);
    if (params.notificationTo) query.set("notificationTo", params.notificationTo);
    if (params.notificationSort !== "newest") query.set("notificationSort", params.notificationSort);
    if (input.notificationPage && input.notificationPage > 1)
      query.set("notificationPage", String(input.notificationPage));
    if (params.returnStatus !== "ALL") query.set("returnStatus", params.returnStatus);
    if (params.cancellationStatus !== "ALL") query.set("cancellationStatus", params.cancellationStatus);
    if (params.disputeStatus !== "ALL") query.set("disputeStatus", params.disputeStatus);
    if (params.returnQ) query.set("returnQ", params.returnQ);
    if (params.cancellationQ) query.set("cancellationQ", params.cancellationQ);
    if (params.disputeQ) query.set("disputeQ", params.disputeQ);
    if (params.returnSellerId) query.set("returnSellerId", params.returnSellerId);
    if (params.cancellationSellerId) query.set("cancellationSellerId", params.cancellationSellerId);
    if (params.disputeSellerId) query.set("disputeSellerId", params.disputeSellerId);
    if (params.returnFrom) query.set("returnFrom", params.returnFrom);
    if (params.returnTo) query.set("returnTo", params.returnTo);
    if (params.returnSort !== "oldest") query.set("returnSort", params.returnSort);
    if (params.cancellationFrom) query.set("cancellationFrom", params.cancellationFrom);
    if (params.cancellationTo) query.set("cancellationTo", params.cancellationTo);
    if (params.cancellationSort !== "oldest") query.set("cancellationSort", params.cancellationSort);
    if (params.disputeFrom) query.set("disputeFrom", params.disputeFrom);
    if (params.disputeTo) query.set("disputeTo", params.disputeTo);
    if (params.disputeSort !== "oldest") query.set("disputeSort", params.disputeSort);
    if (input.returnPage && input.returnPage > 1) query.set("returnPage", String(input.returnPage));
    if (input.cancellationPage && input.cancellationPage > 1)
      query.set("cancellationPage", String(input.cancellationPage));
    if (input.disputePage && input.disputePage > 1) query.set("disputePage", String(input.disputePage));
    if (couponParams.couponQ) query.set("couponQ", couponParams.couponQ);
    if (couponParams.couponActive !== "ALL") query.set("couponActive", couponParams.couponActive);
    if (couponParams.couponValidity !== "ALL") query.set("couponValidity", couponParams.couponValidity);
    if (input.couponPage && input.couponPage > 1) query.set("couponPage", String(input.couponPage));
    const serialized = query.toString();
    return (serialized ? `/admin?${serialized}` : "/admin") as Route;
  }

  const categoryOptions = catalog.categories.map((category) => ({
    id: category.id,
    label: category.parent ? `${category.parent.name} / ${category.name}` : category.name,
  }));
  const manufacturerOptions = catalog.manufacturers.map((manufacturer) => ({
    id: manufacturer.id,
    label: manufacturer.name,
  }));
  const modelOptions = catalog.manufacturers.flatMap((manufacturer) =>
    manufacturer.models.map((model) => ({ id: model.id, label: `${manufacturer.name} ${model.name}` })),
  );

  return (
    <div className="flex flex-col gap-6">
      <IntegrationReadiness />
      <Link href="/admin/moderation" className="text-primary w-fit text-sm font-medium underline underline-offset-4">
        Moderar perguntas e avaliações
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Catálogo controlado pela Moto Shop</CardTitle>
          <CardDescription>
            Sellers usam estas categorias, marcas e motos aprovadas. Desativar preserva o histórico e impede novos usos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3">
              <h3 className="font-medium">Categorias</h3>
              <CategoryForm categories={categoryOptions} />
              <div className="divide-border divide-y">
                {catalog.categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {category.parent ? `${category.parent.name} / ` : ""}
                      {category.name} <span className="text-muted-foreground">({category._count.products})</span>
                    </span>
                    <form action={toggleCategoryAction.bind(null, category.id)}>
                      <button className="text-xs underline">{category.active ? "Desativar" : "Ativar"}</button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-medium">Marcas</h3>
              <BrandForm />
              <div className="divide-border divide-y">
                {catalog.brands.map((brand) => (
                  <div key={brand.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {brand.name} <span className="text-muted-foreground">({brand._count.products})</span>
                    </span>
                    <form action={toggleBrandAction.bind(null, brand.id)}>
                      <button className="text-xs underline">{brand.active ? "Desativar" : "Ativar"}</button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-medium">Fabricantes</h3>
              <MotorcycleManufacturerForm />
              <div className="divide-border divide-y">
                {catalog.manufacturers.map((manufacturer) => (
                  <div key={manufacturer.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>{manufacturer.name}</span>
                    <form action={toggleMotorcycleManufacturerAction.bind(null, manufacturer.id)}>
                      <button className="text-xs underline">{manufacturer.active ? "Desativar" : "Ativar"}</button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-medium">Modelos</h3>
              <MotorcycleModelForm manufacturers={manufacturerOptions} />
              <div className="divide-border divide-y">
                {catalog.manufacturers.flatMap((manufacturer) =>
                  manufacturer.models.map((model) => (
                    <div key={model.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span>
                        {manufacturer.name} {model.name}{" "}
                        <span className="text-muted-foreground">({model._count.fitments} fitments)</span>
                      </span>
                      <form action={toggleMotorcycleModelAction.bind(null, model.id)}>
                        <button className="text-xs underline">{model.active ? "Desativar" : "Ativar"}</button>
                      </form>
                    </div>
                  )),
                )}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-medium">Fitments de moto</h3>
              <MotorcycleFitmentForm models={modelOptions} />
              <div className="divide-border divide-y">
                {catalog.manufacturers.flatMap((manufacturer) =>
                  manufacturer.models.flatMap((model) =>
                    model.fitments.slice(0, 8).map((fitment) => (
                      <div key={fitment.id} className="py-2 text-sm">
                        {manufacturer.name} {model.name} · {fitment.version || "padrão"} · {fitment.displacementCc}cc ·{" "}
                        {fitment.year}
                      </div>
                    )),
                  ),
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Comissão do marketplace</CardTitle>
          <CardDescription>
            Defina a comissão padrão em basis points. Overrides individuais de sellers continuam válidos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CommissionForm defaultCommissionBps={marketplaceConfiguration?.defaultCommissionBps ?? 0} />
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Eventos de webhook</CardTitle>
            <CardDescription>Monitore recebimento, processamento e falhas de integrações críticas.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="mb-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_180px_160px_150px_150px_auto] sm:items-end"
              method="get"
            >
              <label className="flex flex-col gap-1 text-sm font-medium">
                Buscar evento
                <Input
                  className="h-9"
                  name="webhookQ"
                  defaultValue={params.webhookQ ?? ""}
                  placeholder="Tipo, ID ou erro"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Provider
                <Input
                  className="h-9"
                  name="webhookProvider"
                  defaultValue={params.webhookProvider ?? ""}
                  placeholder="MERCADO_PAGO"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Status
                <DesignSelect
                  aria-label="Status"
                  className="h-9"
                  name="webhookStatus"
                  defaultValue={params.webhookStatus ?? "ALL"}
                >
                  <option value="ALL">Todos</option>
                  {Object.entries(webhookStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </DesignSelect>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                De
                <Input className="h-9" name="webhookFrom" type="date" defaultValue={params.webhookFrom ?? ""} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Até
                <Input className="h-9" name="webhookTo" type="date" defaultValue={params.webhookTo ?? ""} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Ordenação
                <DesignSelect
                  aria-label="Ordenação"
                  className="h-9"
                  name="webhookSort"
                  defaultValue={params.webhookSort}
                >
                  <option value="newest">Mais recentes</option>
                  <option value="oldest">Mais antigos</option>
                </DesignSelect>
              </label>
              <Button type="submit" size="sm" className="rounded-md px-4">
                Filtrar
              </Button>
            </form>
            {webhookResult.events.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum webhook encontrado.</p>
            ) : (
              <div className="divide-border divide-y">
                {webhookResult.events.map((event) => (
                  <div key={event.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {event.type} · {event.provider}
                      </span>
                      <Badge variant={event.status === "FAILED" ? "destructive" : "outline"}>
                        {webhookStatusLabels[event.status] ?? event.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {event.externalId} · {new Intl.DateTimeFormat("pt-BR").format(event.receivedAt)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {event.error ? <p className="text-destructive text-xs">{event.error}</p> : null}
                      {event.status === "FAILED" ? (
                        <form action={retryWebhookEventAction.bind(null, event.id)}>
                          <button className="text-primary text-xs font-medium underline">Reprocessar</button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {webhookResult.pageCount > 1 ? (
              <Pagination
                ariaLabel="Paginação de webhooks"
                page={webhookResult.page}
                pageCount={webhookResult.pageCount}
                previousHref={adminHref({ webhookPage: webhookResult.page - 1 })}
                nextHref={adminHref({ webhookPage: webhookResult.page + 1 })}
                summary={<>{webhookResult.total}</>}
                className="mt-4"
              />
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Entregas de notificações</CardTitle>
            <CardDescription>Acompanhe e-mails transacionais enviados pela Moto Shop.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="mb-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_180px_160px_150px_150px_auto] sm:items-end"
              method="get"
            >
              <label className="flex flex-col gap-1 text-sm font-medium">
                Buscar entrega
                <Input
                  className="h-9"
                  name="notificationQ"
                  defaultValue={params.notificationQ ?? ""}
                  placeholder="E-mail, assunto ou evento"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Tipo
                <Input
                  className="h-9"
                  name="notificationKind"
                  defaultValue={params.notificationKind ?? ""}
                  placeholder="ORDER_PAYMENT"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Status
                <DesignSelect
                  aria-label="Status"
                  className="h-9"
                  name="notificationStatus"
                  defaultValue={params.notificationStatus ?? "ALL"}
                >
                  <option value="ALL">Todos</option>
                  {Object.entries(notificationStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </DesignSelect>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                De
                <Input
                  className="h-9"
                  name="notificationFrom"
                  type="date"
                  defaultValue={params.notificationFrom ?? ""}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Até
                <Input className="h-9" name="notificationTo" type="date" defaultValue={params.notificationTo ?? ""} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Ordenação
                <DesignSelect
                  aria-label="Ordenação"
                  className="h-9"
                  name="notificationSort"
                  defaultValue={params.notificationSort}
                >
                  <option value="newest">Mais recentes</option>
                  <option value="oldest">Mais antigos</option>
                </DesignSelect>
              </label>
              <Button type="submit" size="sm" className="rounded-md px-4">
                Filtrar
              </Button>
            </form>
            {notificationResult.deliveries.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma entrega encontrada.</p>
            ) : (
              <div className="divide-border divide-y">
                {notificationResult.deliveries.map((delivery) => (
                  <div key={delivery.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{delivery.kind}</span>
                      <Badge variant={delivery.status === "FAILED" ? "destructive" : "outline"}>
                        {notificationStatusLabels[delivery.status] ?? delivery.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {delivery.recipientEmail} · {delivery.subject}
                    </p>
                    {delivery.error ? <p className="text-destructive mt-1 text-xs">{delivery.error}</p> : null}
                  </div>
                ))}
              </div>
            )}
            {notificationResult.pageCount > 1 ? (
              <Pagination
                ariaLabel="Paginação de notificações"
                page={notificationResult.page}
                pageCount={notificationResult.pageCount}
                previousHref={adminHref({ notificationPage: notificationResult.page - 1 })}
                nextHref={adminHref({ notificationPage: notificationResult.page + 1 })}
                summary={<>{notificationResult.total}</>}
                className="mt-4"
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pedidos em operação</CardTitle>
          <CardDescription>
            Visão consolidada dos pedidos por seller para acompanhamento administrativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="mb-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-7 lg:items-end"
            method="get"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Buscar pedido
              <Input
                className="h-9"
                name="adminOrderQ"
                defaultValue={params.adminOrderQ ?? ""}
                placeholder="Número, cliente ou loja"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status do pedido
              <DesignSelect
                aria-label="Status do pedido"
                className="h-9"
                name="adminOrderStatus"
                defaultValue={params.adminOrderStatus}
              >
                <option value="ALL">Todos</option>
                {Object.entries(adminOrderStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Loja
              <DesignSelect
                aria-label="Loja"
                className="h-9"
                name="adminOrderSellerId"
                defaultValue={params.adminOrderSellerId ?? ""}
              >
                <option value="">Todas as lojas</option>
                {sellerOptions.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.store?.name ?? "Sem loja"}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status do envio
              <DesignSelect
                aria-label="Status do envio"
                className="h-9"
                name="adminOrderShipmentStatus"
                defaultValue={params.adminOrderShipmentStatus}
              >
                <option value="ALL">Todos</option>
                {Object.entries(shipmentStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ordenação
              <DesignSelect
                aria-label="Ordenação"
                className="h-9"
                name="adminOrderSort"
                defaultValue={params.adminOrderSort}
              >
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              De
              <Input className="h-9" name="adminOrderFrom" type="date" defaultValue={params.adminOrderFrom ?? ""} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Até
              <Input className="h-9" name="adminOrderTo" type="date" defaultValue={params.adminOrderTo ?? ""} />
            </label>
            <Button type="submit" size="sm" className="rounded-md px-4">
              Filtrar
            </Button>
          </form>
          {adminOrderResult.orders.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum pedido encontrado.</p>
          ) : (
            <div className="divide-border divide-y">
              {adminOrderResult.orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col gap-2 py-3 text-sm lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{order.order.orderNumber}</span>
                      <Badge variant="outline">{adminOrderStatusLabels[order.status] ?? order.status}</Badge>
                      {order.shipment ? (
                        <Badge variant="secondary">
                          {shipmentStatusLabels[order.shipment.status] ?? order.shipment.status}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {order.storeNameSnapshot} · {order.order.customerName} · {order.order.customerEmail} ·{" "}
                      {order._count.items} item(ns)
                    </p>
                  </div>
                  <div className="text-muted-foreground text-xs lg:text-right">
                    <p>{order.shipment?.trackingCode ?? "Sem rastreio"}</p>
                    <p>{new Intl.DateTimeFormat("pt-BR").format(order.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {adminOrderResult.pageCount > 1 ? (
            <Pagination
              ariaLabel="Paginação de pedidos administrativos"
              page={adminOrderResult.page}
              pageCount={adminOrderResult.pageCount}
              previousHref={adminHref({ adminOrderPage: adminOrderResult.page - 1 })}
              nextHref={adminHref({ adminOrderPage: adminOrderResult.page + 1 })}
              summary={<>{adminOrderResult.total} pedido(s)</>}
              className="mt-5"
            />
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Plano VIP e exposição</CardTitle>
          <CardDescription>
            Ative o VIP manualmente enquanto a cobrança recorrente ainda não está integrada. O selo patrocinado é
            exibido no storefront e o boost é um critério pequeno, depois de relevância, estoque e reputação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <VipSubscriptionForm
            sellers={sellers
              .filter((seller) => seller.status === "APPROVED" || seller.status === "ACTIVE")
              .map((seller) => ({
                id: seller.id,
                name: seller.store?.name ?? "Sem loja",
                hasActiveVip: seller.subscriptions.length > 0,
              }))}
          />
          <div className="divide-border divide-y">
            {sellers
              .filter((seller) => seller.subscriptions.length > 0)
              .map((seller) => (
                <div key={seller.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-semibold">{seller.store?.name ?? "Sem loja"}</span>
                  <span className="text-muted-foreground">
                    VIP ativo até {seller.subscriptions[0]?.endsAt.toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cupons do marketplace</CardTitle>
          <CardDescription>
            Crie descontos globais financiados pela Moto Shop. Valores são centavos e percentuais usam basis points.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CouponForm ownerType="MARKETPLACE" />
          <form
            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_180px_180px_auto] sm:items-end"
            method="get"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Buscar cupom
              <Input className="h-9" name="couponQ" defaultValue={couponParams.couponQ ?? ""} placeholder="Código" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status
              <DesignSelect
                aria-label="Status"
                className="h-9"
                name="couponActive"
                defaultValue={couponParams.couponActive}
              >
                <option value="ALL">Todos</option>
                <option value="ACTIVE">Ativos</option>
                <option value="INACTIVE">Inativos</option>
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Vigência
              <DesignSelect
                aria-label="Vigência"
                className="h-9"
                name="couponValidity"
                defaultValue={couponParams.couponValidity}
              >
                <option value="ALL">Todas</option>
                <option value="CURRENT">Vigentes</option>
                <option value="UPCOMING">Futuros</option>
                <option value="EXPIRED">Expirados</option>
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ordenação
              <DesignSelect
                aria-label="Ordenação"
                className="h-9"
                name="couponSort"
                defaultValue={couponParams.couponSort}
              >
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
                <option value="ends_soonest">Validade mais próxima</option>
                <option value="code_asc">Código A–Z</option>
              </DesignSelect>
            </label>
            <Button type="submit" size="sm" className="rounded-md px-4">
              Filtrar
            </Button>
          </form>
          <div className="divide-border divide-y">
            {marketplaceCoupons.map((coupon) => (
              <div key={coupon.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="font-semibold">{coupon.code}</span>
                <span className="text-muted-foreground">
                  {coupon.discountType === "PERCENTAGE"
                    ? `${(coupon.percentageBps ?? 0) / 100}%`
                    : formatMoneyInCents(coupon.fixedAmountInCents ?? 0)}{" "}
                  · {coupon.active ? "Ativo" : "Inativo"} · Uso: {coupon._count.redemptions}
                  {coupon.globalUsageLimit !== null ? `/${coupon.globalUsageLimit}` : ""}
                  {coupon.endsAt ? ` · até ${new Intl.DateTimeFormat("pt-BR").format(coupon.endsAt)}` : ""}
                </span>
                <form action={setMarketplaceCouponActiveAction.bind(null, coupon.id, !coupon.active)}>
                  <button className="text-primary text-xs font-medium underline">
                    {coupon.active ? "Desativar" : "Ativar"}
                  </button>
                </form>
              </div>
            ))}
          </div>
          {couponResult.pageCount > 1 ? (
            <Pagination
              ariaLabel="Paginação de cupons do marketplace"
              page={couponResult.page}
              pageCount={couponResult.pageCount}
              previousHref={adminHref({ couponPage: couponResult.page - 1 })}
              nextHref={adminHref({ couponPage: couponResult.page + 1 })}
              summary={<>{couponResult.total} cupom(ns)</>}
            />
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Solicitações de sellers</CardTitle>
          <CardDescription>Aprove lojas antes de liberar a operação do catálogo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="mb-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_180px_180px_auto] sm:items-end"
            method="get"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Buscar seller
              <Input
                className="h-9"
                name="sellerQ"
                defaultValue={params.sellerQ ?? ""}
                placeholder="Loja, nome ou e-mail"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status do seller
              <DesignSelect
                aria-label="Status do seller"
                className="h-9"
                name="sellerStatus"
                defaultValue={params.sellerStatus}
              >
                <option value="ALL">Todos</option>
                <option value="PENDING">Pendentes</option>
                <option value="APPROVED">Aprovados</option>
                <option value="ACTIVE">Ativos</option>
                <option value="SUSPENDED">Suspensos</option>
                <option value="BLOCKED">Bloqueados</option>
                <option value="REJECTED">Rejeitados</option>
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ordenação
              <DesignSelect aria-label="Ordenação" className="h-9" name="sellerSort" defaultValue={params.sellerSort}>
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
              </DesignSelect>
            </label>
            <Button type="submit" size="sm" className="rounded-md px-4">
              Filtrar
            </Button>
          </form>
          {sellers.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma solicitação encontrada.</p>
          ) : (
            <div className="divide-border divide-y">
              {sellers.map((seller) => (
                <div
                  key={seller.id}
                  data-testid={`seller-review-${seller.id}`}
                  className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{seller.store?.name ?? "Sem loja"}</h3>
                      <Badge variant="outline">{seller.status}</Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {seller.members[0]?.user.email} · {seller._count.products} produto(s)
                    </p>
                    <SellerCommissionForm sellerId={seller.id} commissionBpsOverride={seller.commissionBpsOverride} />
                  </div>
                  {seller.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <form action={approveSellerAction.bind(null, seller.id)}>
                        <Button type="submit" size="sm" className="rounded-md">
                          Aprovar
                        </Button>
                      </form>
                      <form action={rejectSellerAction.bind(null, seller.id)}>
                        <Button type="submit" variant="outline" size="sm" className="rounded-md">
                          Rejeitar
                        </Button>
                      </form>
                    </div>
                  ) : seller.status === "SUSPENDED" ? (
                    <form action={reactivateSellerAction.bind(null, seller.id)}>
                      <Button type="submit" size="sm" className="rounded-md">
                        Reativar
                      </Button>
                    </form>
                  ) : seller.status === "APPROVED" || seller.status === "ACTIVE" ? (
                    <form action={suspendSellerAction.bind(null, seller.id)}>
                      <Button type="submit" variant="outline" size="sm" className="rounded-md">
                        Suspender
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {sellerResult.pageCount > 1 ? (
            <Pagination
              ariaLabel="Paginação de sellers"
              page={sellerResult.page}
              pageCount={sellerResult.pageCount}
              previousHref={adminHref({ sellerPage: sellerResult.page - 1 })}
              nextHref={adminHref({ sellerPage: sellerResult.page + 1 })}
              summary={<>{sellerResult.total} seller(s)</>}
              className="mt-5"
            />
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cancelamentos</CardTitle>
          <CardDescription>
            Analise pedidos ainda não postados; pedidos enviados seguem o fluxo de devolução.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="mb-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
            method="get"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status do cancelamento
              <DesignSelect
                aria-label="Status do cancelamento"
                className="h-9"
                name="cancellationStatus"
                defaultValue={params.cancellationStatus}
              >
                <option value="ALL">Abertos</option>
                <option value="REQUESTED">Solicitados</option>
                <option value="APPROVED">Aprovados</option>
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Buscar
              <Input
                className="h-9"
                name="cancellationQ"
                defaultValue={params.cancellationQ ?? ""}
                placeholder="Pedido, item, SKU ou loja"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Seller
              <DesignSelect
                aria-label="Seller"
                className="h-9"
                name="cancellationSellerId"
                defaultValue={params.cancellationSellerId ?? ""}
              >
                <option value="">Todos</option>
                {sellerOptions.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.store?.name ?? "Sem loja"}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              De
              <Input className="h-9" name="cancellationFrom" type="date" defaultValue={params.cancellationFrom ?? ""} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Até
              <Input className="h-9" name="cancellationTo" type="date" defaultValue={params.cancellationTo ?? ""} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ordenação
              <DesignSelect
                aria-label="Ordenação"
                className="h-9"
                name="cancellationSort"
                defaultValue={params.cancellationSort}
              >
                <option value="oldest">Mais antigos</option>
                <option value="newest">Mais recentes</option>
              </DesignSelect>
            </label>
            <Button type="submit" size="sm" className="rounded-md px-4">
              Filtrar
            </Button>
          </form>
          {cancellationRequests.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma solicitação de cancelamento aguardando ação.</p>
          ) : (
            <div className="divide-border divide-y">
              {cancellationRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-4 py-4 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">Pedido {request.order.orderNumber}</h3>
                      <Badge variant="outline">{request.status}</Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {request.seller.store?.name ?? "Seller"} · {request.order.customerName} ·{" "}
                      {request.order.customerEmail}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {request.sellerOrder.items
                        .map((item) => `${item.productNameSnapshot} (${item.quantity})`)
                        .join(" · ")}{" "}
                      · {formatMoneyInCents(request.amountInCents)}
                    </p>
                    {request.customerMessage ? (
                      <p className="text-muted-foreground mt-1 text-xs">Motivo: {request.customerMessage}</p>
                    ) : null}
                  </div>
                  {request.status === "REQUESTED" || request.status === "APPROVED" ? (
                    <CancellationStatusActions cancellationRequestId={request.id} status={request.status} />
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {cancellationResult.pageCount > 1 ? (
            <Pagination
              ariaLabel="Paginação de cancelamentos"
              page={cancellationResult.page}
              pageCount={cancellationResult.pageCount}
              previousHref={adminHref({ cancellationPage: cancellationResult.page - 1 })}
              nextHref={adminHref({ cancellationPage: cancellationResult.page + 1 })}
              summary={<>{cancellationResult.total} solicitação(ões)</>}
              className="mt-5"
            />
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Disputas</CardTitle>
          <CardDescription>Faça a mediação entre cliente e seller com histórico auditável.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="mb-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
            method="get"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status da disputa
              <DesignSelect
                aria-label="Status da disputa"
                className="h-9"
                name="disputeStatus"
                defaultValue={params.disputeStatus}
              >
                <option value="ALL">Abertas</option>
                <option value="OPEN">Abertas novas</option>
                <option value="UNDER_REVIEW">Em análise</option>
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Buscar
              <Input
                className="h-9"
                name="disputeQ"
                defaultValue={params.disputeQ ?? ""}
                placeholder="Pedido, item, SKU ou loja"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Seller
              <DesignSelect
                aria-label="Seller"
                className="h-9"
                name="disputeSellerId"
                defaultValue={params.disputeSellerId ?? ""}
              >
                <option value="">Todos</option>
                {sellerOptions.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.store?.name ?? "Sem loja"}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              De
              <Input className="h-9" name="disputeFrom" type="date" defaultValue={params.disputeFrom ?? ""} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Até
              <Input className="h-9" name="disputeTo" type="date" defaultValue={params.disputeTo ?? ""} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ordenação
              <DesignSelect aria-label="Ordenação" className="h-9" name="disputeSort" defaultValue={params.disputeSort}>
                <option value="oldest">Mais antigos</option>
                <option value="newest">Mais recentes</option>
              </DesignSelect>
            </label>
            <Button type="submit" size="sm" className="rounded-md px-4">
              Filtrar
            </Button>
          </form>
          {disputes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma disputa aguardando ação.</p>
          ) : (
            <div className="divide-border divide-y">
              {disputes.map((dispute) => (
                <div
                  key={dispute.id}
                  className="flex flex-col gap-4 py-4 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">Pedido {dispute.order.orderNumber}</h3>
                      <Badge variant="outline">{dispute.status}</Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {dispute.seller.store?.name ?? "Seller"} · {dispute.order.customerName} ·{" "}
                      {dispute.order.customerEmail}
                    </p>
                    <p className="mt-2 text-sm font-medium">{dispute.reason}</p>
                    <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">{dispute.description}</p>
                  </div>
                  <DisputeStatusActions disputeId={dispute.id} status={dispute.status} />
                </div>
              ))}
            </div>
          )}
          {disputeResult.pageCount > 1 ? (
            <Pagination
              ariaLabel="Paginação de disputas"
              page={disputeResult.page}
              pageCount={disputeResult.pageCount}
              previousHref={adminHref({ disputePage: disputeResult.page - 1 })}
              nextHref={adminHref({ disputePage: disputeResult.page + 1 })}
              summary={<>{disputeResult.total} disputa(s)</>}
              className="mt-5"
            />
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Devoluções e reembolsos</CardTitle>
          <CardDescription>
            Avalie solicitações, registre o recebimento físico e só então processe o reembolso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="mb-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
            method="get"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status da devolução
              <DesignSelect
                aria-label="Status da devolução"
                className="h-9"
                name="returnStatus"
                defaultValue={params.returnStatus}
              >
                <option value="ALL">Em aberto</option>
                <option value="REQUESTED">Solicitadas</option>
                <option value="UNDER_REVIEW">Em análise</option>
                <option value="APPROVED">Aprovadas</option>
                <option value="RETURNED">Recebidas</option>
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Buscar
              <Input
                className="h-9"
                name="returnQ"
                defaultValue={params.returnQ ?? ""}
                placeholder="Pedido, item, SKU, loja ou motivo"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Seller
              <DesignSelect
                aria-label="Seller"
                className="h-9"
                name="returnSellerId"
                defaultValue={params.returnSellerId ?? ""}
              >
                <option value="">Todos</option>
                {sellerOptions.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.store?.name ?? "Sem loja"}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              De
              <Input className="h-9" name="returnFrom" type="date" defaultValue={params.returnFrom ?? ""} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Até
              <Input className="h-9" name="returnTo" type="date" defaultValue={params.returnTo ?? ""} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ordenação
              <DesignSelect aria-label="Ordenação" className="h-9" name="returnSort" defaultValue={params.returnSort}>
                <option value="oldest">Mais antigos</option>
                <option value="newest">Mais recentes</option>
              </DesignSelect>
            </label>
            <Button type="submit" size="sm" className="rounded-md px-4">
              Filtrar
            </Button>
          </form>
          {returnRequests.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma devolução aguardando ação.</p>
          ) : (
            <div className="divide-border divide-y">
              {returnRequests.map((request) => {
                const item = request.items[0];
                return (
                  <div
                    key={request.id}
                    className="flex flex-col gap-4 py-4 lg:flex-row lg:items-start lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">Pedido {request.order.orderNumber}</h3>
                        <Badge variant="outline">{returnStatusLabels[request.status] ?? request.status}</Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {request.seller.store?.name ?? "Seller"} · {request.order.customerName} ·{" "}
                        {request.order.customerEmail}
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {item?.orderItem.productNameSnapshot ?? "Item"} · quantidade {item?.quantity ?? 0} · valor
                        estimado {formatMoneyInCents(request.amountInCents)}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Motivo: {returnReasonLabels[request.reason] ?? request.reason}
                        {request.customerMessage ? ` · ${request.customerMessage}` : ""}
                      </p>
                      {request.adminNote ? (
                        <p className="text-muted-foreground mt-1 text-xs">Nota: {request.adminNote}</p>
                      ) : null}
                    </div>
                    <ReturnStatusActions returnRequestId={request.id} status={request.status} />
                  </div>
                );
              })}
            </div>
          )}
          {returnResult.pageCount > 1 ? (
            <Pagination
              ariaLabel="Paginação de devoluções"
              page={returnResult.page}
              pageCount={returnResult.pageCount}
              previousHref={adminHref({ returnPage: returnResult.page - 1 })}
              nextHref={adminHref({ returnPage: returnResult.page + 1 })}
              summary={<>{returnResult.total} solicitação(ões)</>}
              className="mt-5"
            />
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Produtos aguardando revisão</CardTitle>
          <CardDescription>Produtos submetidos pelos sellers para publicação.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="mb-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-8 lg:items-end"
            method="get"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Buscar produto
              <Input
                className="h-9"
                name="productReviewQ"
                defaultValue={params.productReviewQ ?? ""}
                placeholder="Nome, SKU ou loja"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Categoria
              <DesignSelect
                aria-label="Categoria"
                className="h-9"
                name="productReviewCategoryId"
                defaultValue={params.productReviewCategoryId ?? ""}
              >
                <option value="">Todas</option>
                {catalog.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parent ? `${category.parent.name} / ` : ""}
                    {category.name}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Marca
              <DesignSelect
                aria-label="Marca"
                className="h-9"
                name="productReviewBrandId"
                defaultValue={params.productReviewBrandId ?? ""}
              >
                <option value="">Todas</option>
                {catalog.brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Seller
              <DesignSelect
                aria-label="Seller"
                className="h-9"
                name="productReviewSellerId"
                defaultValue={params.productReviewSellerId ?? ""}
              >
                <option value="">Todos</option>
                {sellerOptions.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.store?.name ?? "Sem loja"}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              De
              <Input
                className="h-9"
                name="productReviewFrom"
                type="date"
                defaultValue={params.productReviewFrom ?? ""}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Até
              <Input className="h-9" name="productReviewTo" type="date" defaultValue={params.productReviewTo ?? ""} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status da revisão
              <DesignSelect
                aria-label="Status da revisão"
                className="h-9"
                name="productReviewStatus"
                defaultValue={params.productReviewStatus}
              >
                <option value="ALL">Submetidos e rejeitados</option>
                <option value="SUBMITTED">Aguardando aprovação</option>
                <option value="REJECTED">Rejeitados</option>
              </DesignSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ordenação
              <DesignSelect
                aria-label="Ordenação"
                className="h-9"
                name="productReviewSort"
                defaultValue={params.productReviewSort}
              >
                <option value="oldest">Mais antigas</option>
                <option value="newest">Mais recentes</option>
              </DesignSelect>
            </label>
            <Button type="submit" size="sm" className="rounded-md px-4">
              Filtrar
            </Button>
          </form>
          {products.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum produto aguardando revisão.</p>
          ) : (
            <div className="divide-border divide-y">
              {products.map((product) => (
                <div key={product.id} data-testid={`product-review-${product.id}`} className="flex flex-col gap-4 py-4">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="bg-muted flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden rounded-md border sm:w-28">
                      {product.images[0] && getPublicStorageUrl(product.images[0].storageKey) ? (
                        <Image
                          src={getPublicStorageUrl(product.images[0].storageKey)!}
                          alt={product.images[0].altText ?? product.name}
                          width={112}
                          height={112}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-muted-foreground px-2 text-center text-xs">Sem foto pública</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{product.name}</h3>
                        <Badge variant="outline">{product.status}</Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {product.seller.store?.name} · {product.brand.name} · {product.category.name}
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm">{product.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {product.variants
                          .filter((variant) => variant.active)
                          .map((variant) => (
                            <span key={variant.id} className="rounded-md border px-2 py-1 text-xs">
                              {variant.title} · {variant.sku} · {formatMoneyInCents(variant.priceInCents)} · estoque{" "}
                              {variant.inventory?.availableQuantity ?? 0}
                            </span>
                          ))}
                      </div>
                      {product.compatibilities.length > 0 ? (
                        <p className="text-muted-foreground mt-2 text-xs">
                          Compatível com:{" "}
                          {product.compatibilities
                            .map(
                              ({ motorcycleFitment: fitment }) =>
                                `${fitment.motorcycleModel.manufacturer.name} ${fitment.motorcycleModel.name} ${fitment.year}`,
                            )
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {product.status === "SUBMITTED" ? (
                    <ProductStatusActions productId={product.id} />
                  ) : (
                    <p className="text-muted-foreground text-xs">Rejeitado: {product.rejectionReason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {productResult.pageCount > 1 ? (
            <Pagination
              ariaLabel="Paginação da fila de produtos"
              page={productResult.page}
              pageCount={productResult.pageCount}
              previousHref={adminHref({ productReviewPage: productResult.page - 1 })}
              nextHref={adminHref({ productReviewPage: productResult.page + 1 })}
              summary={<>{productResult.total} produto(s)</>}
              className="mt-5"
            />
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Auditoria administrativa</CardTitle>
          <CardDescription>Consulte alterações críticas com ator, entidade e metadados registrados.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="mb-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-4 lg:grid-cols-6 lg:items-end"
            method="get"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ação
              <Input
                className="h-9"
                name="auditAction"
                defaultValue={params.auditAction ?? ""}
                placeholder="ORDER_STATUS_CHANGED"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Entidade
              <Input
                className="h-9"
                name="auditEntityType"
                defaultValue={params.auditEntityType ?? ""}
                placeholder="Order ou SellerOrder"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              ID da entidade
              <Input className="h-9" name="auditQ" defaultValue={params.auditQ ?? ""} placeholder="ID interno" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ator
              <Input
                className="h-9"
                name="auditActorQ"
                defaultValue={params.auditActorQ ?? ""}
                placeholder="Nome ou e-mail"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              De
              <Input className="h-9" name="auditFrom" type="date" defaultValue={params.auditFrom ?? ""} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Até
              <Input className="h-9" name="auditTo" type="date" defaultValue={params.auditTo ?? ""} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ordenação
              <DesignSelect aria-label="Ordenação" className="h-9" name="auditSort" defaultValue={params.auditSort}>
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
              </DesignSelect>
            </label>
            <Button type="submit" size="sm" className="rounded-md px-4">
              Filtrar
            </Button>
          </form>
          {auditResult.logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum registro de auditoria encontrado.</p>
          ) : (
            <div className="divide-border divide-y">
              {auditResult.logs.map((log) => (
                <div key={log.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {log.action} · {log.entityType}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {new Intl.DateTimeFormat("pt-BR").format(log.createdAt)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {log.entityId} · {log.actor.name ?? log.actor.email} · {log.actor.email}
                  </p>
                  {log.metadata ? (
                    <pre className="bg-muted/40 mt-2 overflow-x-auto rounded-md p-2 text-[11px] whitespace-pre-wrap">
                      {JSON.stringify(log.metadata)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {auditResult.pageCount > 1 ? (
            <Pagination
              ariaLabel="Paginação da auditoria"
              page={auditResult.page}
              pageCount={auditResult.pageCount}
              previousHref={adminHref({ auditPage: auditResult.page - 1 })}
              nextHref={adminHref({ auditPage: auditResult.page + 1 })}
              summary={<>{auditResult.total} registro(s)</>}
              className="mt-5"
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
