import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { DesignSelect } from "@/components/ui/design-select";
import Link from "next/link";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatMoneyInCents } from "@/lib/utils";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { hasSellerPermission } from "@/modules/auth/domain/seller-permissions";
import { CouponForm } from "@/modules/coupons/components/coupon-form";
import { listSellerCoupons } from "@/modules/coupons/queries/coupons";
import { loadCouponSearchParams } from "@/modules/coupons/search-params";
import { archiveProductAction, restoreProductAction } from "@/modules/products/actions/product-actions";
import { ProductSubmissionAction } from "@/modules/products/components/product-submission-action";
import { setSellerCouponActiveAction } from "@/modules/coupons/actions/coupon-actions";
import { InventoryAdjustForm } from "@/modules/products/components/inventory-adjust-form";
import { listProductBrands, listProductCategories, listSellerProducts } from "@/modules/products/queries/products";
import { loadSellerProductSearchParams } from "@/modules/products/seller-search-params";
import { SellerOnboardingForm } from "@/modules/sellers/components/seller-onboarding-form";
import { SellerApplicationStatus } from "@/modules/sellers/components/seller-application-status";
import { SellerCatalogProgress } from "@/modules/sellers/components/seller-catalog-progress";
import { ShippingOriginForm } from "@/modules/sellers/components/shipping-origin-form";
import { SellerTeamManager } from "@/modules/sellers/components/seller-team-manager";
import { StoreBrandingManager } from "@/modules/sellers/components/store-branding-manager";
import { StoreProfileForm } from "@/modules/sellers/components/store-profile-form";
import { getUserSellerMemberships } from "@/modules/sellers/queries/sellers";
import { getSellerFinancialSummary, listSellerLowStockVariants } from "@/modules/sellers/queries/seller-dashboard";
import { getSellerCatalogProgress } from "@/modules/sellers/queries/seller-catalog-progress";
import { listSellerInventoryMovements } from "@/modules/sellers/queries/inventory-movements";
import { loadInventorySearchParams } from "@/modules/sellers/inventory-search-params";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

function statusLabel(status: string) {
  return (
    {
      DRAFT: "Rascunho",
      SUBMITTED: "Em aprovação",
      APPROVED: "Aprovado",
      REJECTED: "Rejeitado",
      ARCHIVED: "Arquivado",
    }[status] ?? status
  );
}

const inventoryMovementLabels: Record<string, string> = {
  SALE: "Venda",
  RESERVATION: "Reserva",
  RESERVATION_RELEASE: "Liberação de reserva",
  RETURN: "Devolução",
  CANCELLATION: "Cancelamento",
  MANUAL_IN: "Entrada manual",
  MANUAL_OUT: "Saída manual",
  CORRECTION: "Correção",
};

export default async function SellerHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuthenticatedUser("/seller");
  const memberships = await getUserSellerMemberships(session.user.id);
  const membership = memberships[0];

  if (!membership) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cadastre sua loja</CardTitle>
          <CardDescription>
            Crie o perfil da sua loja para começar o processo de aprovação da Moto Shop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SellerOnboardingForm />
        </CardContent>
      </Card>
    );
  }

  const { seller } = membership;
  const canManageTeam = hasSellerPermission(membership.role, "SELLER_MANAGE");
  const canManageCatalog = hasSellerPermission(membership.role, "PRODUCT_UPDATE");
  const canCreateProduct = hasSellerPermission(membership.role, "PRODUCT_CREATE");
  const canManageCoupons = hasSellerPermission(membership.role, "COUPON_MANAGE");
  const canReadFinances = hasSellerPermission(membership.role, "FINANCE_READ");
  const canReadOrders = hasSellerPermission(membership.role, "ORDER_READ");
  if (seller.status !== "ACTIVE" && seller.status !== "APPROVED") {
    return <SellerApplicationStatus storeName={seller.store?.name ?? "Sua loja"} status={seller.status} />;
  }

  const productParams = await loadSellerProductSearchParams(searchParams);
  const couponParams = await loadCouponSearchParams(searchParams);
  const inventoryParams = await loadInventorySearchParams(searchParams);
  const [
    productResult,
    couponResult,
    financialSummary,
    lowStockVariants,
    inventoryMovements,
    categories,
    brands,
    catalogProgress,
  ] = await Promise.all([
    canManageCatalog
      ? listSellerProducts(seller.id, {
          query: productParams.productQ,
          categoryId: productParams.productCategory,
          brandId: productParams.productBrand,
          minPriceInCents: productParams.productMinPrice,
          maxPriceInCents: productParams.productMaxPrice,
          status: productParams.productStatus,
          stock: productParams.productStock,
          promotion: productParams.productPromotion,
          sort: productParams.productSort,
          page: productParams.productPage,
        })
      : Promise.resolve({ products: [], total: 0, page: 1, pageCount: 1 }),
    canManageCoupons
      ? listSellerCoupons(seller.id, {
          query: couponParams.couponQ,
          active: couponParams.couponActive,
          validity: couponParams.couponValidity,
          sort: couponParams.couponSort,
          page: couponParams.couponPage,
        })
      : Promise.resolve({ coupons: [], total: 0, page: 1, pageCount: 1 }),
    canReadFinances
      ? getSellerFinancialSummary(seller.id)
      : Promise.resolve({ orderCount: 0, grossSalesInCents: 0, commissionInCents: 0, sellerNetAmountInCents: 0 }),
    canManageCatalog ? listSellerLowStockVariants(seller.id) : Promise.resolve([]),
    canManageCatalog
      ? listSellerInventoryMovements(seller.id, {
          q: inventoryParams.q,
          type: inventoryParams.movementType,
          from: inventoryParams.from,
          to: inventoryParams.to,
          sort: inventoryParams.sort,
        })
      : Promise.resolve([]),
    listProductCategories(),
    listProductBrands(),
    canManageCatalog
      ? getSellerCatalogProgress(seller.id)
      : Promise.resolve({ editable: 0, submitted: 0, approved: 0 }),
  ]);
  const products = productResult.products;
  const coupons = couponResult.coupons;

  function productPageHref(page: number): Route {
    const query = new URLSearchParams();
    if (productParams.productQ) query.set("productQ", productParams.productQ);
    if (productParams.productCategory) query.set("productCategory", productParams.productCategory);
    if (productParams.productBrand) query.set("productBrand", productParams.productBrand);
    if (productParams.productMinPrice !== null && productParams.productMinPrice !== undefined)
      query.set("productMinPrice", String(productParams.productMinPrice));
    if (productParams.productMaxPrice !== null && productParams.productMaxPrice !== undefined)
      query.set("productMaxPrice", String(productParams.productMaxPrice));
    if (productParams.productStatus !== "ALL") query.set("productStatus", productParams.productStatus);
    if (productParams.productStock !== "ALL") query.set("productStock", productParams.productStock);
    if (productParams.productPromotion !== "ALL") query.set("productPromotion", productParams.productPromotion);
    if (productParams.productSort !== "updated_newest") query.set("productSort", productParams.productSort);
    if (inventoryParams.movementType !== "ALL") query.set("movementType", inventoryParams.movementType);
    if (inventoryParams.q) query.set("q", inventoryParams.q);
    if (inventoryParams.from) query.set("from", inventoryParams.from);
    if (inventoryParams.to) query.set("to", inventoryParams.to);
    if (inventoryParams.sort !== "newest") query.set("sort", inventoryParams.sort);
    if (page > 1) query.set("productPage", String(page));
    const serialized = query.toString();
    return (serialized ? `/seller?${serialized}` : "/seller") as Route;
  }

  function couponPageHref(page: number): Route {
    const query = new URLSearchParams();
    if (couponParams.couponQ) query.set("couponQ", couponParams.couponQ);
    if (couponParams.couponActive !== "ALL") query.set("couponActive", couponParams.couponActive);
    if (couponParams.couponValidity !== "ALL") query.set("couponValidity", couponParams.couponValidity);
    if (couponParams.couponSort !== "newest") query.set("couponSort", couponParams.couponSort);
    if (inventoryParams.movementType !== "ALL") query.set("movementType", inventoryParams.movementType);
    if (inventoryParams.q) query.set("q", inventoryParams.q);
    if (inventoryParams.from) query.set("from", inventoryParams.from);
    if (inventoryParams.to) query.set("to", inventoryParams.to);
    if (inventoryParams.sort !== "newest") query.set("sort", inventoryParams.sort);
    if (page > 1) query.set("couponPage", String(page));
    const serialized = query.toString();
    return (serialized ? `/seller?${serialized}` : "/seller") as Route;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge variant="secondary">Seller ativo</Badge>
          <h2 className="mt-2 text-2xl font-semibold">{seller.store?.name}</h2>
          <p className="text-muted-foreground text-sm">Gerencie catálogo, aprovação e estoque da sua loja.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReadOrders ? (
            <Link href="/seller/orders" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Pedidos e envios
            </Link>
          ) : null}
          {canManageCatalog ? (
            <Link
              href={{ pathname: "/seller/questions" }}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Perguntas
            </Link>
          ) : null}
          {canCreateProduct ? (
            <Link href="/seller/products/new" className={cn(buttonVariants({ size: "lg" }))}>
              Novo produto
            </Link>
          ) : null}
        </div>
      </div>
      {canManageCatalog ? <SellerCatalogProgress progress={catalogProgress} /> : null}
      {canManageTeam ? (
        <Link href={"/seller/shipping" as Route} className={cn(buttonVariants({ variant: "outline" }))}>
          Configurar frete próprio
        </Link>
      ) : null}
      {seller.store ? (
        <>
          {canManageTeam ? (
            <Card>
              <CardHeader>
                <CardTitle>Perfil público da loja</CardTitle>
                <CardDescription>
                  Nome, endereço público e apresentação exibidos na vitrine da Moto Shop. Dados de origem ficam em uma
                  seção separada e não são publicados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StoreProfileForm
                  store={{ name: seller.store.name, slug: seller.store.slug, description: seller.store.description }}
                />
              </CardContent>
            </Card>
          ) : null}
          {canManageTeam ? (
            <Card>
              <CardHeader>
                <CardTitle>Identidade visual</CardTitle>
                <CardDescription>
                  Adicione a logo e o banner que serão exibidos na vitrine pública da loja.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StoreBrandingManager
                  initialImages={{
                    logoUrl: seller.store.logoStorageKey ? getPublicStorageUrl(seller.store.logoStorageKey) : null,
                    bannerUrl: seller.store.bannerStorageKey
                      ? getPublicStorageUrl(seller.store.bannerStorageKey)
                      : null,
                  }}
                />
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Dados de envio</CardTitle>
              <CardDescription>
                Preencha o remetente usado nas etiquetas do Melhor Envio. O endereço do cliente vem de cada pedido.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShippingOriginForm store={seller.store} />
            </CardContent>
          </Card>
        </>
      ) : null}
      {canManageTeam ? (
        <Card>
          <CardHeader>
            <CardTitle>Equipe da loja</CardTitle>
            <CardDescription>
              Adicione contas existentes e limite o acesso por função. Convites por e-mail ficam para uma etapa
              posterior.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SellerTeamManager
              members={seller.members.map((member) => ({
                id: member.id,
                name: member.user.name,
                email: member.user.email,
                role: member.role,
              }))}
            />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Plano VIP</CardTitle>
          <CardDescription>
            Mais exposição para produtos aprovados, com identificação de conteúdo patrocinado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {seller.subscriptions[0] ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge>VIP ativo</Badge>
              <span className="text-muted-foreground">
                Válido até {seller.subscriptions[0].endsAt.toLocaleDateString("pt-BR")} · ativação administrada pela
                Moto Shop.
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Sua loja ainda não possui VIP ativo. Fale com a Moto Shop para solicitar a ativação.
            </p>
          )}
        </CardContent>
      </Card>
      {canManageCoupons ? (
        <Card>
          <CardHeader>
            <CardTitle>Cupons da loja</CardTitle>
            <CardDescription>{couponResult.total} cupom(ns) · descontos financiados pela sua loja.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CouponForm ownerType="SELLER" />
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
              {coupons.map((coupon) => (
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
                  <form action={setSellerCouponActiveAction.bind(null, coupon.id, !coupon.active)}>
                    <button className="text-primary text-xs font-medium underline">
                      {coupon.active ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </div>
              ))}
            </div>
            {couponResult.pageCount > 1 ? (
              <Pagination
                ariaLabel="Paginação de cupons do seller"
                page={couponResult.page}
                pageCount={couponResult.pageCount}
                previousHref={couponPageHref(couponResult.page - 1)}
                nextHref={couponPageHref(couponResult.page + 1)}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        {canReadFinances ? (
          <Card>
            <CardHeader>
              <CardTitle>Resumo financeiro</CardTitle>
              <CardDescription>Vendas confirmadas e valores registrados por pedido.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-xs">Vendas</p>
                <p className="mt-1 text-lg font-semibold">{formatMoneyInCents(financialSummary.grossSalesInCents)}</p>
                <p className="text-muted-foreground text-xs">{financialSummary.orderCount} {financialSummary.orderCount === 1 ? "pedido" : "pedidos"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Comissão da Moto Shop</p>
                <p className="mt-1 text-lg font-semibold">{formatMoneyInCents(financialSummary.commissionInCents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Líquido do seller</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatMoneyInCents(financialSummary.sellerNetAmountInCents)}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {canManageCatalog ? (
          <Card>
            <CardHeader>
              <CardTitle>Estoque baixo</CardTitle>
              <CardDescription>Variantes com até 5 unidades disponíveis.</CardDescription>
            </CardHeader>
            <CardContent>
              {lowStockVariants.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma variante precisa de reposição agora.</p>
              ) : (
                <div className="divide-border divide-y">
                  {lowStockVariants.map((inventory) => (
                    <div key={inventory.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        {inventory.variant.product.status === "DRAFT" ||
                        inventory.variant.product.status === "REJECTED" ? (
                          <Link
                            href={`/seller/products/${inventory.variant.product.id}/edit`}
                            className="font-medium hover:underline"
                          >
                            {inventory.variant.product.name}
                          </Link>
                        ) : inventory.variant.product.status === "APPROVED" ? (
                          <Link
                            href={`/products/${inventory.variant.product.slug}`}
                            className="font-medium hover:underline"
                          >
                            {inventory.variant.product.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{inventory.variant.product.name}</span>
                        )}
                        <p className="text-muted-foreground text-xs">
                          {inventory.variant.title} · SKU {inventory.variant.sku}
                        </p>
                      </div>
                      <Badge variant={inventory.availableQuantity === 0 ? "destructive" : "outline"}>
                        {inventory.availableQuantity} un.
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
      {canManageCatalog ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Histórico de estoque</CardTitle>
              <CardDescription>Últimas movimentações auditáveis das variantes da loja.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border p-3" method="get">
                <label className="flex min-w-56 flex-col gap-1 text-sm font-medium">
                  Buscar produto ou SKU
                  <Input
                    className="h-9"
                    name="q"
                    defaultValue={inventoryParams.q ?? ""}
                    placeholder="Nome, variante ou SKU"
                  />
                </label>
                <label className="flex min-w-56 flex-col gap-1 text-sm font-medium">
                  Tipo de movimentação
                  <DesignSelect
                    aria-label="Tipo de movimentação"
                    className="h-9"
                    name="movementType"
                    defaultValue={inventoryParams.movementType}
                  >
                    <option value="ALL">Todos</option>
                    {Object.entries(inventoryMovementLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </DesignSelect>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  De
                  <Input className="h-9" name="from" type="date" defaultValue={inventoryParams.from ?? ""} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Até
                  <Input className="h-9" name="to" type="date" defaultValue={inventoryParams.to ?? ""} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Ordenação
                  <DesignSelect aria-label="Ordenação" className="h-9" name="sort" defaultValue={inventoryParams.sort}>
                    <option value="newest">Mais recentes</option>
                    <option value="oldest">Mais antigos</option>
                  </DesignSelect>
                </label>
                <Button type="submit" size="sm" className="rounded-md px-4">
                  Filtrar
                </Button>
              </form>
              {inventoryMovements.length === 0 ? (
                <p className="text-muted-foreground text-sm">Ainda não há movimentações de estoque.</p>
              ) : (
                <div className="divide-border divide-y">
                  {inventoryMovements.map((movement) => (
                    <div
                      key={movement.id}
                      className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <Link
                          href={`/seller/products/${movement.variant.product.id}/edit`}
                          className="font-medium hover:underline"
                        >
                          {movement.variant.product.name}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          {movement.variant.title} · SKU {movement.variant.sku} ·{" "}
                          {inventoryMovementLabels[movement.type] ?? movement.type}
                        </p>
                      </div>
                      <div className="text-xs sm:text-right">
                        <p className={movement.quantityChange < 0 ? "text-destructive" : "text-emerald-700"}>
                          {movement.quantityChange > 0 ? "+" : ""}
                          {movement.quantityChange} · saldo {movement.availableQuantityAfter}
                        </p>
                        <p className="text-muted-foreground">
                          {new Intl.DateTimeFormat("pt-BR").format(movement.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Produtos</CardTitle>
              <CardDescription>{productResult.total} {productResult.total === 1 ? "produto cadastrado" : "produtos cadastrados"}.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="mb-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Buscar produto
                  <Input
                    className="h-9"
                    name="productQ"
                    defaultValue={productParams.productQ ?? ""}
                    placeholder="Nome, slug ou SKU"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Categoria
                  <DesignSelect
                    aria-label="Categoria"
                    className="h-9"
                    name="productCategory"
                    defaultValue={productParams.productCategory ?? ""}
                  >
                    <option value="">Todas</option>
                    {categories.map((category) => (
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
                    name="productBrand"
                    defaultValue={productParams.productBrand ?? ""}
                  >
                    <option value="">Todas</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </DesignSelect>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Preço mín. (centavos)
                  <Input
                    className="h-9"
                    name="productMinPrice"
                    type="number"
                    min="0"
                    defaultValue={productParams.productMinPrice ?? ""}
                    placeholder="Ex.: 5000"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Preço máx. (centavos)
                  <Input
                    className="h-9"
                    name="productMaxPrice"
                    type="number"
                    min="0"
                    defaultValue={productParams.productMaxPrice ?? ""}
                    placeholder="Ex.: 100000"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Status
                  <DesignSelect
                    aria-label="Status"
                    className="h-9"
                    name="productStatus"
                    defaultValue={productParams.productStatus}
                  >
                    <option value="ALL">Todos</option>
                    <option value="DRAFT">Rascunhos</option>
                    <option value="SUBMITTED">Em aprovação</option>
                    <option value="APPROVED">Aprovados</option>
                    <option value="REJECTED">Rejeitados</option>
                    <option value="ARCHIVED">Arquivados</option>
                  </DesignSelect>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Estoque
                  <DesignSelect
                    aria-label="Estoque"
                    className="h-9"
                    name="productStock"
                    defaultValue={productParams.productStock}
                  >
                    <option value="ALL">Todos</option>
                    <option value="IN">Em estoque</option>
                    <option value="LOW">Baixo (1–5)</option>
                    <option value="OUT">Esgotado</option>
                  </DesignSelect>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Promoção
                  <DesignSelect
                    aria-label="Promoção"
                    className="h-9"
                    name="productPromotion"
                    defaultValue={productParams.productPromotion}
                  >
                    <option value="ALL">Todas</option>
                    <option value="ON_SALE">Em promoção</option>
                  </DesignSelect>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Ordenação
                  <DesignSelect
                    aria-label="Ordenação"
                    className="h-9"
                    name="productSort"
                    defaultValue={productParams.productSort}
                  >
                    <option value="updated_newest">Atualizados recentemente</option>
                    <option value="updated_oldest">Atualizados há mais tempo</option>
                    <option value="name_asc">Nome A–Z</option>
                    <option value="name_desc">Nome Z–A</option>
                  </DesignSelect>
                </label>
                <Button type="submit" size="sm" className="self-end rounded-md px-4">
                  Filtrar
                </Button>
              </form>
              {products.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Ainda não há produtos. Comece criando seu primeiro rascunho.
                </p>
              ) : (
                <div className="divide-border divide-y">
                  {products.map((product) => {
                    return (
                      <div
                        key={product.id}
                        className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">{product.name}</h3>
                            <Badge variant="outline">{statusLabel(product.status)}</Badge>
                          </div>
                          <p className="text-muted-foreground mt-1 text-sm">
                            {product.brand.name} · {product.category.name} · {product.variants.length} variação(ões)
                          </p>
                          {product.variants.length > 0 ? (
                            <div className="mt-2 space-y-2">
                              {product.variants.map((variant) => (
                                <div key={variant.id} className="rounded-md border border-dashed p-2 text-xs">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-medium">
                                      {variant.title} · {variant.sku}
                                    </span>
                                    <span>
                                      {formatMoneyInCents(variant.priceInCents)} · estoque{" "}
                                      {variant.inventory?.availableQuantity ?? 0}
                                    </span>
                                  </div>
                                  <InventoryAdjustForm variantId={variant.id} />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted-foreground mt-2 text-xs">Sem variantes cadastradas.</p>
                          )}
                          {product.rejectionReason ? (
                            <p className="text-destructive mt-1 text-xs">Motivo: {product.rejectionReason}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {product.status === "APPROVED" ? (
                            <Link
                              href={`/products/${product.slug}`}
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                            >
                              Ver página
                            </Link>
                          ) : null}
                          {product.status === "DRAFT" || product.status === "REJECTED" ? (
                            <Link
                              href={`/seller/products/${product.id}/edit`}
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                            >
                              Editar
                            </Link>
                          ) : null}
                          {product.status === "ARCHIVED" ? (
                            <form action={restoreProductAction.bind(null, product.id)}>
                              <Button size="sm">Restaurar</Button>
                            </form>
                          ) : null}
                          {product.status === "DRAFT" || product.status === "REJECTED" ? (
                            <ProductSubmissionAction productId={product.id} />
                          ) : null}
                          {product.status === "DRAFT" || product.status === "REJECTED" ? (
                            <form action={archiveProductAction.bind(null, product.id)}>
                              <Button size="sm" variant="ghost">
                                Arquivar
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {productResult.pageCount > 1 ? (
                <Pagination
                  ariaLabel="Paginação de produtos do seller"
                  page={productResult.page}
                  pageCount={productResult.pageCount}
                  previousHref={productPageHref(productResult.page - 1)}
                  nextHref={productPageHref(productResult.page + 1)}
                  className="mt-5"
                />
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
