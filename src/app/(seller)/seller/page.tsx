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
import { archiveProductAction, restoreProductAction, submitProductAction } from "@/modules/products/actions/product-actions";
import { setSellerCouponActiveAction } from "@/modules/coupons/actions/coupon-actions";
import { InventoryAdjustForm } from "@/modules/products/components/inventory-adjust-form";
import { listProductBrands, listProductCategories, listSellerProducts } from "@/modules/products/queries/products";
import { loadSellerProductSearchParams } from "@/modules/products/seller-search-params";
import { SellerOnboardingForm } from "@/modules/sellers/components/seller-onboarding-form";
import { ShippingOriginForm } from "@/modules/sellers/components/shipping-origin-form";
import { SellerTeamManager } from "@/modules/sellers/components/seller-team-manager";
import { StoreBrandingManager } from "@/modules/sellers/components/store-branding-manager";
import { StoreProfileForm } from "@/modules/sellers/components/store-profile-form";
import { getUserSellerMemberships } from "@/modules/sellers/queries/sellers";
import { getSellerFinancialSummary, listSellerLowStockVariants } from "@/modules/sellers/queries/seller-dashboard";
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
          <CardDescription>Crie o perfil do seller para começar o processo de aprovação do MotoShop.</CardDescription>
        </CardHeader>
        <CardContent>
          <SellerOnboardingForm />
        </CardContent>
      </Card>
    );
  }

  const { seller } = membership;
  const canManageTeam = hasSellerPermission(membership.role, "SELLER_MANAGE");
  if (seller.status !== "ACTIVE" && seller.status !== "APPROVED") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{seller.store?.name ?? "Sua loja"}</CardTitle>
          <CardDescription>Cadastro recebido e aguardando análise do MotoShop.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Badge variant="secondary">
            Status:{" "}
            {seller.status === "PENDING" ? "Em análise" : seller.status === "REJECTED" ? "Rejeitado" : seller.status}
          </Badge>
          <p className="text-muted-foreground text-sm">
            Quando a loja for aprovada, você poderá cadastrar produtos e controlar o estoque por variante.
          </p>
        </CardContent>
      </Card>
    );
  }

  const productParams = await loadSellerProductSearchParams(searchParams);
  const couponParams = await loadCouponSearchParams(searchParams);
  const inventoryParams = await loadInventorySearchParams(searchParams);
  const [productResult, couponResult, financialSummary, lowStockVariants, inventoryMovements, categories, brands] = await Promise.all([
    listSellerProducts(seller.id, {
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
    }),
    listSellerCoupons(seller.id, {
      query: couponParams.couponQ,
      active: couponParams.couponActive,
      validity: couponParams.couponValidity,
      sort: couponParams.couponSort,
      page: couponParams.couponPage,
    }),
    getSellerFinancialSummary(seller.id),
    listSellerLowStockVariants(seller.id),
    listSellerInventoryMovements(seller.id, {
      q: inventoryParams.q,
      type: inventoryParams.movementType,
      from: inventoryParams.from,
      to: inventoryParams.to,
      sort: inventoryParams.sort,
    }),
    listProductCategories(),
    listProductBrands(),
  ]);
  const products = productResult.products;
  const coupons = couponResult.coupons;

  function productPageHref(page: number): Route {
    const query = new URLSearchParams();
    if (productParams.productQ) query.set("productQ", productParams.productQ);
    if (productParams.productCategory) query.set("productCategory", productParams.productCategory);
    if (productParams.productBrand) query.set("productBrand", productParams.productBrand);
    if (productParams.productMinPrice !== null && productParams.productMinPrice !== undefined) query.set("productMinPrice", String(productParams.productMinPrice));
    if (productParams.productMaxPrice !== null && productParams.productMaxPrice !== undefined) query.set("productMaxPrice", String(productParams.productMaxPrice));
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
          <Link href="/seller/orders" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Pedidos e envios
          </Link>
          <Link
            href={{ pathname: "/seller/questions" }}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Perguntas
          </Link>
          <Link href="/seller/products/new" className={cn(buttonVariants({ size: "lg" }))}>
            Novo produto
          </Link>
        </div>
      </div>
      {seller.store ? (
        <>
          {canManageTeam ? (
            <Card>
              <CardHeader>
                <CardTitle>Perfil público da loja</CardTitle>
                <CardDescription>
                  Nome, endereço público e apresentação exibidos na vitrine do MotoShop. Dados de origem ficam em uma
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
                Válido até {seller.subscriptions[0].endsAt.toLocaleDateString("pt-BR")} · ativação administrada pelo
                MotoShop.
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Sua loja ainda não possui VIP ativo. Fale com o MotoShop para solicitar a ativação.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cupons da loja</CardTitle>
          <CardDescription>{couponResult.total} cupom(ns) · descontos financiados pela sua loja.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CouponForm ownerType="SELLER" />
          <form className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_180px_180px_auto] sm:items-end" method="get">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Buscar cupom
              <input
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="couponQ"
                defaultValue={couponParams.couponQ ?? ""}
                placeholder="Código"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="couponActive"
                defaultValue={couponParams.couponActive}
              >
                <option value="ALL">Todos</option>
                <option value="ACTIVE">Ativos</option>
                <option value="INACTIVE">Inativos</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Vigência
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="couponValidity"
                defaultValue={couponParams.couponValidity}
              >
                <option value="ALL">Todas</option>
                <option value="CURRENT">Vigentes</option>
                <option value="UPCOMING">Futuros</option>
                <option value="EXPIRED">Expirados</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ordenação
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="couponSort"
                defaultValue={couponParams.couponSort}
              >
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
                <option value="ends_soonest">Validade mais próxima</option>
                <option value="code_asc">Código A–Z</option>
              </select>
            </label>
            <button className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm font-medium">
              Filtrar
            </button>
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
            <nav className="flex items-center justify-between gap-3" aria-label="Paginação de cupons do seller">
              {couponResult.page > 1 ? (
                <Link href={couponPageHref(couponResult.page - 1)} className="rounded-md border px-3 py-2 text-sm">
                  Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground text-sm">
                Página {couponResult.page} de {couponResult.pageCount}
              </span>
              {couponResult.page < couponResult.pageCount ? (
                <Link href={couponPageHref(couponResult.page + 1)} className="rounded-md border px-3 py-2 text-sm">
                  Próxima
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resumo financeiro</CardTitle>
            <CardDescription>Vendas confirmadas e valores registrados por pedido.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">Vendas</p>
              <p className="mt-1 text-lg font-semibold">{formatMoneyInCents(financialSummary.grossSalesInCents)}</p>
              <p className="text-muted-foreground text-xs">{financialSummary.orderCount} pedido(s)</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Comissão MotoShop</p>
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
                      <Link
                        href={`/seller/products/${inventory.variant.product.id}/edit`}
                        className="font-medium hover:underline"
                      >
                        {inventory.variant.product.name}
                      </Link>
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
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Histórico de estoque</CardTitle>
          <CardDescription>Últimas movimentações auditáveis das variantes da loja.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border p-3" method="get">
            <label className="flex min-w-56 flex-col gap-1 text-sm font-medium">
              Buscar produto ou SKU
              <input className="border-input bg-background h-9 rounded-md border px-3 text-sm" name="q" defaultValue={inventoryParams.q ?? ""} placeholder="Nome, variante ou SKU" />
            </label>
            <label className="flex min-w-56 flex-col gap-1 text-sm font-medium">
              Tipo de movimentação
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="movementType"
                defaultValue={inventoryParams.movementType}
              >
                <option value="ALL">Todos</option>
                {Object.entries(inventoryMovementLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              De
              <input
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="from"
                type="date"
                defaultValue={inventoryParams.from ?? ""}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Até
              <input
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="to"
                type="date"
                defaultValue={inventoryParams.to ?? ""}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ordenação
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="sort"
                defaultValue={inventoryParams.sort}
              >
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
              </select>
            </label>
            <button className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm font-medium">
              Filtrar
            </button>
          </form>
          {inventoryMovements.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ainda não há movimentações de estoque.</p>
          ) : (
            <div className="divide-border divide-y">
              {inventoryMovements.map((movement) => (
                <div key={movement.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link href={`/seller/products/${movement.variant.product.id}/edit`} className="font-medium hover:underline">
                      {movement.variant.product.name}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                        {movement.variant.title} · SKU {movement.variant.sku} · {inventoryMovementLabels[movement.type] ?? movement.type}
                    </p>
                  </div>
                  <div className="text-xs sm:text-right">
                    <p className={movement.quantityChange < 0 ? "text-destructive" : "text-emerald-700"}>
                      {movement.quantityChange > 0 ? "+" : ""}{movement.quantityChange} · saldo {movement.availableQuantityAfter}
                    </p>
                    <p className="text-muted-foreground">{new Intl.DateTimeFormat("pt-BR").format(movement.createdAt)}</p>
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
          <CardDescription>{productResult.total} produto(s) cadastrado(s).</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="mb-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-7" method="get">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Buscar produto
              <input
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="productQ"
                defaultValue={productParams.productQ ?? ""}
                placeholder="Nome, slug ou SKU"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Categoria
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="productCategory"
                defaultValue={productParams.productCategory ?? ""}
              >
                <option value="">Todas</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parent ? `${category.parent.name} / ` : ""}{category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Marca
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="productBrand"
                defaultValue={productParams.productBrand ?? ""}
              >
                <option value="">Todas</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Preço mín. (centavos)
              <input
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="productMinPrice"
                type="number"
                min="0"
                defaultValue={productParams.productMinPrice ?? ""}
                placeholder="Ex.: 5000"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Preço máx. (centavos)
              <input
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="productMaxPrice"
                type="number"
                min="0"
                defaultValue={productParams.productMaxPrice ?? ""}
                placeholder="Ex.: 100000"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="productStatus"
                defaultValue={productParams.productStatus}
              >
                <option value="ALL">Todos</option>
                <option value="DRAFT">Rascunhos</option>
                <option value="SUBMITTED">Em aprovação</option>
                <option value="APPROVED">Aprovados</option>
                <option value="REJECTED">Rejeitados</option>
                <option value="ARCHIVED">Arquivados</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Estoque
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="productStock"
                defaultValue={productParams.productStock}
              >
                <option value="ALL">Todos</option>
                <option value="IN">Em estoque</option>
                <option value="LOW">Baixo (1–5)</option>
                <option value="OUT">Esgotado</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Promoção
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="productPromotion"
                defaultValue={productParams.productPromotion}
              >
                <option value="ALL">Todas</option>
                <option value="ON_SALE">Em promoção</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ordenação
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                name="productSort"
                defaultValue={productParams.productSort}
              >
                <option value="updated_newest">Atualizados recentemente</option>
                <option value="updated_oldest">Atualizados há mais tempo</option>
                <option value="name_asc">Nome A–Z</option>
                <option value="name_desc">Nome Z–A</option>
              </select>
            </label>
            <button className="bg-primary text-primary-foreground h-9 self-end rounded-md px-4 text-sm font-medium">
              Filtrar
            </button>
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
                      <Link
                        href={`/products/${product.slug}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Ver página
                      </Link>
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
                        <form action={submitProductAction.bind(null, product.id)}>
                          <Button size="sm">Enviar para aprovação</Button>
                        </form>
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
            <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Paginação de produtos do seller">
              {productResult.page > 1 ? (
                <Link href={productPageHref(productResult.page - 1)} className="rounded-md border px-3 py-2 text-sm">
                  Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground text-sm">
                Página {productResult.page} de {productResult.pageCount}
              </span>
              {productResult.page < productResult.pageCount ? (
                <Link href={productPageHref(productResult.page + 1)} className="rounded-md border px-3 py-2 text-sm">
                  Próxima
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
