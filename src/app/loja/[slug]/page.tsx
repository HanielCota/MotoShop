import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { DesignSelect } from "@/components/ui/design-select";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Route } from "next";
import Image from "next/image";

import { Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/format";
import { formatRating } from "@/modules/reviews/domain/rating";
import { ReviewStars } from "@/modules/reviews/components/review-stars";
import { CatalogFiltersPanel } from "@/modules/catalog/components/catalog-filters-panel";
import { CatalogSortSelect } from "@/modules/catalog/components/catalog-sort-select";
import { getPublicStoreBySlug } from "@/modules/catalog/queries/public-catalog";
import { loadPublicStoreSearchParams } from "@/modules/catalog/search-params";
import { ProductGrid } from "@/modules/products/components/product-grid";
import { listApprovedProducts } from "@/modules/products/queries/products";

const storeSortOptions = [
  { value: "relevance", label: "Mais relevantes" },
  { value: "newest", label: "Mais recentes" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
] as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getPublicStoreBySlug(slug);
  if (!store) return { title: "Loja não encontrada" };
  return {
    title: store.name,
    description: store.description ?? `Produtos da loja ${store.name} no marketplace do Moto Shop.`,
    alternates: { canonical: `/loja/${store.slug}` },
  };
}

export default async function PublicStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const storeParams = await loadPublicStoreSearchParams(searchParams);
  const store = await getPublicStoreBySlug(slug, {
    reviewPage: storeParams.storeReviewPage,
    reviewSort: storeParams.storeReviewSort,
  });
  if (!store) notFound();

  const result = await listApprovedProducts({
    sellerId: store.sellerId,
    query: storeParams.storeProductQ,
    sort: storeParams.storeProductSort,
    availability: storeParams.storeProductAvailability,
    promotion: storeParams.storeProductPromotion,
    page: storeParams.storeProductPage,
    pageSize: 12,
  });
  const rating = store.reviewSummary.average;
  const activeProductFilterCount = [
    Boolean(storeParams.storeProductQ),
    storeParams.storeProductAvailability !== "ALL",
    storeParams.storeProductPromotion !== "ALL",
  ].filter(Boolean).length;
  const hasActiveProductFilters = activeProductFilterCount > 0;
  const storeSlug = store.slug;
  const storeInitials = store.name
    .split(/[\s·]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
  const socialLinks = [
    { label: "Instagram", href: store.instagramUrl },
    { label: "YouTube", href: store.youtubeUrl },
    { label: "WhatsApp", href: store.whatsappUrl },
    { label: "Facebook", href: store.facebookUrl },
  ].filter((social) => social.href);

  function storeHref(
    overrides: { productPage?: number; reviewPage?: number; productSort?: (typeof storeSortOptions)[number]["value"] } = {},
  ): Route {
    const query = new URLSearchParams();
    const reviewPage = overrides.reviewPage ?? storeParams.storeReviewPage;
    const productPage = overrides.productPage ?? storeParams.storeProductPage;
    if (reviewPage > 1) query.set("storeReviewPage", String(reviewPage));
    if (storeParams.storeReviewSort !== "newest") query.set("storeReviewSort", storeParams.storeReviewSort);
    if (storeParams.storeProductQ) query.set("storeProductQ", storeParams.storeProductQ);
    if (storeParams.storeProductAvailability !== "ALL")
      query.set("storeProductAvailability", storeParams.storeProductAvailability);
    if (storeParams.storeProductPromotion !== "ALL")
      query.set("storeProductPromotion", storeParams.storeProductPromotion);
    const productSort = overrides.productSort ?? storeParams.storeProductSort;
    if (productSort !== "relevance") query.set("storeProductSort", productSort);
    if (productPage > 1) query.set("storeProductPage", String(productPage));
    const serialized = query.toString();
    return (serialized ? `/loja/${storeSlug}?${serialized}` : `/loja/${storeSlug}`) as Route;
  }
  const clearProductFiltersHref = (() => {
    const query = new URLSearchParams();
    if (storeParams.storeReviewPage > 1) query.set("storeReviewPage", String(storeParams.storeReviewPage));
    if (storeParams.storeReviewSort !== "newest") query.set("storeReviewSort", storeParams.storeReviewSort);
    const serialized = query.toString();
    return `/loja/${storeSlug}${serialized ? `?${serialized}` : ""}#produtos`;
  })();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <section
        className="relative isolate overflow-hidden rounded-[1.75rem] bg-moto-brand-foreground text-white shadow-[0_24px_70px_-50px_rgba(0,0,0,0.8)]"
        aria-labelledby="store-name"
      >
        {store.bannerUrl ? (
          <Image
            src={store.bannerUrl}
            alt=""
            fill
            priority
            unoptimized
            className="-z-20 object-cover opacity-45"
            sizes="(max-width: 768px) 100vw, 1152px"
          />
        ) : null}
        <div
          className="border-moto-brand/20 absolute -top-28 -right-16 -z-10 size-72 rounded-full border-[42px] sm:size-96"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-r from-moto-brand-foreground via-moto-brand-foreground/90 to-brand-strong/40"
          aria-hidden="true"
        />
        <div className="relative flex min-h-[340px] flex-col justify-between gap-10 p-6 sm:min-h-[390px] sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <span className="text-moto-brand text-xs font-bold tracking-[0.2em] uppercase">
              Vitrine de loja · O Moto Shop
            </span>
            {store.seller.subscriptions.length > 0 ? (
              <Badge className="border-moto-brand/60 bg-moto-brand text-moto-brand-foreground border">Loja VIP</Badge>
            ) : null}
          </div>
          <div className="max-w-3xl">
            <div className="mb-5 flex size-16 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 text-xl font-black tracking-tight sm:size-20 sm:text-2xl">
              {store.logoUrl ? (
                <Image
                  src={store.logoUrl}
                  alt={`Logo da loja ${store.name}`}
                  width={80}
                  height={80}
                  unoptimized
                  className="size-full object-cover"
                />
              ) : (
                <span aria-hidden="true">{storeInitials}</span>
              )}
            </div>
            <h1 id="store-name" className="text-4xl leading-[1.05] font-black tracking-tight sm:text-6xl">
              {store.name}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              {store.description ?? "Produtos desta loja parceira no marketplace de motopeças e equipamentos off-road."}
            </p>
            {socialLinks.length > 0 ? (
              <nav className="mt-5 flex flex-wrap gap-2" aria-label={`Redes sociais da loja ${store.name}`}>
                {socialLinks.map(({ label, href }) => (
                  <a
                    key={label}
                    href={href ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    aria-label={`${label} da loja ${store.name} (abre em nova aba)`}
                    className="hover:border-moto-brand hover:text-moto-brand focus-visible:outline-moto-brand inline-flex min-h-10 items-center justify-center rounded-full border border-white/25 px-4 text-sm font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {label}
                  </a>
                ))}
              </nav>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/20 pt-4 text-sm text-white/80">
            <span>
              <strong className="mr-1 text-lg text-white">{result.total}</strong> produto{result.total === 1 ? "" : "s"}{" "}
              {result.total === 1 ? "exibido" : "exibidos"}
            </span>
            {rating ? (
              <a href="#avaliacoes-loja" className="hover:text-white hover:underline underline-offset-4">
                <span aria-hidden="true" className="text-moto-brand">
                  ★
                </span>{" "}
                {formatRating(rating)}/5 · {store.reviewSummary.count}{" "}
                {store.reviewSummary.count === 1 ? "avaliação" : "avaliações"}
              </a>
            ) : (
              <span>Ainda sem avaliações</span>
            )}
          </div>
        </div>
      </section>

      {result.total === 0 && !hasActiveProductFilters ? (
        <EmptyState
          icon={Store}
          title="Vitrine em preparação"
          description="Esta loja ainda não possui produtos publicados."
          action={{ label: "Explorar todo o catálogo", href: "/products" }}
        />
      ) : (
        <div id="produtos" className="scroll-mt-24 space-y-6">
          <SectionHeader title="Produtos da vitrine" description="Seleção publicada por esta loja." />
          <div className="grid min-w-0 gap-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-start md:gap-8">
            <CatalogFiltersPanel activeCount={activeProductFilterCount}>
              <form
                key={JSON.stringify(storeParams)}
                className="grid min-w-0 content-start gap-4 [&_[data-slot=select-trigger]]:h-11 [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:min-w-0"
                method="get"
                action="#produtos"
              >
                {storeParams.storeReviewPage > 1 ? (
                  <input type="hidden" name="storeReviewPage" value={storeParams.storeReviewPage} />
                ) : null}
                {storeParams.storeReviewSort !== "newest" ? (
                  <input type="hidden" name="storeReviewSort" value={storeParams.storeReviewSort} />
                ) : null}
                {storeParams.storeProductSort !== "relevance" ? (
                  <input type="hidden" name="storeProductSort" value={storeParams.storeProductSort} />
                ) : null}
                <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                  Buscar produto
                  <Input
                    type="search"
                    className="h-11"
                    name="storeProductQ"
                    defaultValue={storeParams.storeProductQ ?? ""}
                    placeholder="Nome, marca, categoria ou SKU"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                  Disponibilidade
                  <DesignSelect
                    aria-label="Disponibilidade"
                    name="storeProductAvailability"
                    defaultValue={storeParams.storeProductAvailability}
                  >
                    <option value="ALL">Todos</option>
                    <option value="IN_STOCK">Em estoque</option>
                    <option value="OUT_OF_STOCK">Indisponíveis</option>
                  </DesignSelect>
                </label>
                <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                  Oferta
                  <DesignSelect aria-label="Oferta" name="storeProductPromotion" defaultValue={storeParams.storeProductPromotion}>
                    <option value="ALL">Todos os preços</option>
                    <option value="ON_SALE">Em oferta</option>
                  </DesignSelect>
                </label>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button type="submit" size="lg" className="flex-1 px-4">
                    Aplicar filtros
                  </Button>
                  <Link
                    href={clearProductFiltersHref as Route}
                    className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center text-sm underline underline-offset-4"
                  >
                    Limpar
                  </Link>
                </div>
              </form>
            </CatalogFiltersPanel>
            <section className="min-w-0" aria-labelledby="store-results-title">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p id="store-results-title" className="text-foreground text-base font-semibold" aria-live="polite">
                  {result.total} {result.total === 1 ? "produto" : "produtos"}
                </p>
                <CatalogSortSelect
                  value={storeParams.storeProductSort}
                  options={storeSortOptions.map((option) => ({
                    ...option,
                    href: `${storeHref({ productPage: 1, productSort: option.value })}#produtos`,
                  }))}
                />
              </div>
              <ProductGrid
                products={result.products}
                emptyMessage="Nenhum produto corresponde à busca ou aos filtros selecionados. Ajuste os critérios e tente novamente."
                emptyAction={{ label: "Limpar filtros", href: clearProductFiltersHref as Route }}
              />
              {result.pageCount > 1 ? (
                <Pagination
                  ariaLabel="Paginação dos produtos da loja"
                  page={result.page}
                  pageCount={result.pageCount}
                  previousHref={storeHref({ productPage: result.page - 1 })}
                  nextHref={storeHref({ productPage: result.page + 1 })}
                />
              ) : null}
            </section>
          </div>
        </div>
      )}

      {store.reviewSummary.count > 0 ? (
        <Card id="avaliacoes-loja" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>
              <h2 className="text-xl">Avaliações da loja</h2>
            </CardTitle>
            <CardDescription>
              Comentários de clientes que compraram no Moto Shop
              {rating ? ` · nota média ${formatRating(rating)}/5` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <form
              className="bg-surface-sunken flex flex-wrap items-end gap-3 rounded-lg p-3 sm:col-span-2 lg:col-span-3"
              method="get"
              action="#avaliacoes-loja"
            >
              {storeParams.storeProductSort !== "relevance" ? (
                <input type="hidden" name="storeProductSort" value={storeParams.storeProductSort} />
              ) : null}
              {storeParams.storeProductQ ? (
                <input type="hidden" name="storeProductQ" value={storeParams.storeProductQ} />
              ) : null}
              {storeParams.storeProductAvailability !== "ALL" ? (
                <input type="hidden" name="storeProductAvailability" value={storeParams.storeProductAvailability} />
              ) : null}
              {storeParams.storeProductPromotion !== "ALL" ? (
                <input type="hidden" name="storeProductPromotion" value={storeParams.storeProductPromotion} />
              ) : null}
              {storeParams.storeProductPage > 1 ? (
                <input type="hidden" name="storeProductPage" value={storeParams.storeProductPage} />
              ) : null}
              <label className="flex flex-col gap-2 text-sm font-medium">
                Ordenar avaliações
                <DesignSelect
                  aria-label="Ordenar avaliações"
                  name="storeReviewSort"
                  defaultValue={storeParams.storeReviewSort}
                >
                  <option value="newest">Mais recentes</option>
                  <option value="oldest">Mais antigas</option>
                </DesignSelect>
              </label>
              <Button type="submit" variant="outline" className="h-10 px-4">
                Aplicar
              </Button>
            </form>
            {store.seller.sellerReviews.map((review) => (
              <article key={review.id} className="border-border bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <ReviewStars rating={review.rating} />
                  <time className="text-muted-foreground text-xs" dateTime={review.createdAt.toISOString()}>
                    {formatDate(review.createdAt)}
                  </time>
                </div>
                <p className="mt-2 text-sm font-medium">{review.user.name ?? "Cliente"}</p>
                {review.comment ? <p className="text-muted-foreground mt-2 text-sm">{review.comment}</p> : null}
                <p className="text-muted-foreground mt-3 text-xs">Compra verificada</p>
              </article>
            ))}
            {store.reviewPageCount > 1 ? (
              <Pagination
                ariaLabel="Paginação das avaliações da loja"
                page={store.reviewPage}
                pageCount={store.reviewPageCount}
                previousHref={storeHref({ reviewPage: store.reviewPage - 1 })}
                nextHref={storeHref({ reviewPage: store.reviewPage + 1 })}
                className="sm:col-span-2 lg:col-span-3"
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
