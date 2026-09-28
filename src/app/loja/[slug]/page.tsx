import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { DesignSelect } from "@/components/ui/design-select";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Route } from "next";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicStoreBySlug } from "@/modules/catalog/queries/public-catalog";
import { loadPublicStoreSearchParams } from "@/modules/catalog/search-params";
import { ProductGrid } from "@/modules/products/components/product-grid";
import { listApprovedProducts } from "@/modules/products/queries/products";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getPublicStoreBySlug(slug);
  if (!store) return { title: "Loja não encontrada" };
  return {
    title: store.name,
    description: store.description ?? `Produtos da loja ${store.name} no marketplace da Moto Shop.`,
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
  const storeSlug = store.slug;
  const storeInitials = store.name
    .split(/[\s·]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

  function storePageHref(productPage: number): Route {
    const query = new URLSearchParams();
    if (storeParams.storeReviewPage > 1) query.set("storeReviewPage", String(storeParams.storeReviewPage));
    if (storeParams.storeReviewSort !== "newest") query.set("storeReviewSort", storeParams.storeReviewSort);
    if (storeParams.storeProductQ) query.set("storeProductQ", storeParams.storeProductQ);
    if (storeParams.storeProductAvailability !== "ALL")
      query.set("storeProductAvailability", storeParams.storeProductAvailability);
    if (storeParams.storeProductPromotion !== "ALL")
      query.set("storeProductPromotion", storeParams.storeProductPromotion);
    if (storeParams.storeProductSort !== "relevance") query.set("storeProductSort", storeParams.storeProductSort);
    if (productPage > 1) query.set("storeProductPage", String(productPage));
    const serialized = query.toString();
    return (serialized ? `/loja/${storeSlug}?${serialized}` : `/loja/${storeSlug}`) as Route;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <section
        className="relative isolate overflow-hidden rounded-[1.75rem] bg-[#191918] text-white shadow-[0_24px_70px_-50px_rgba(0,0,0,0.8)]"
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
          className="absolute -top-28 -right-16 -z-10 size-72 rounded-full border-[42px] border-[#ed5a17]/20 sm:size-96"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-r from-[#191918] via-[#191918]/90 to-[#381e14]/60"
          aria-hidden="true"
        />
        <div className="relative flex min-h-[340px] flex-col justify-between gap-10 p-6 sm:min-h-[390px] sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <span className="text-xs font-bold tracking-[0.2em] text-[#ff8b53] uppercase">
              Vitrine de loja · Moto Shop
            </span>
            {store.seller.subscriptions.length > 0 ? (
              <Badge className="border border-[#ff8b53]/60 bg-[#ff6b28] text-white">Seller VIP</Badge>
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
              {store.description ?? "Catálogo aprovado desta loja dentro do marketplace de motocross."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/20 pt-4 text-sm text-white/80">
            <span>
              <strong className="mr-1 text-lg text-white">{result.total}</strong> produto{result.total === 1 ? "" : "s"}{" "}
              exibidos
            </span>
            {rating ? (
              <span aria-label={`Nota média ${rating.toFixed(1)} de 5, em ${store.reviewSummary.count} avaliações`}>
                <span aria-hidden="true" className="text-[#ff8b53]">
                  ★
                </span>{" "}
                {rating.toFixed(1)}/5 · {store.reviewSummary.count} avaliações
              </span>
            ) : (
              <span>Ainda sem avaliações</span>
            )}
          </div>
        </div>
      </section>

      {store.reviewSummary.count > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Avaliações da loja</CardTitle>
            <CardDescription>
              Comentários de clientes que compraram na Moto Shop · nota média {rating?.toFixed(1)}/5
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <form className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-3" method="get">
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
              <Button type="submit" className="rounded-md px-4">
                Aplicar
              </Button>
            </form>
            {store.seller.sellerReviews.map((review) => (
              <article key={review.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong aria-label={`${review.rating} de 5 estrelas`}>
                    {"★".repeat(review.rating)}
                    <span className="text-muted-foreground">{"☆".repeat(5 - review.rating)}</span>
                  </strong>
                  <time className="text-muted-foreground text-xs" dateTime={review.createdAt.toISOString()}>
                    {review.createdAt.toLocaleDateString("pt-BR")}
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
                previousHref={
                  `/loja/${store.slug}?${new URLSearchParams({
                    storeReviewPage: String(store.reviewPage - 1),
                    ...(storeParams.storeReviewSort !== "newest"
                      ? { storeReviewSort: storeParams.storeReviewSort }
                      : {}),
                    ...(storeParams.storeProductQ ? { storeProductQ: storeParams.storeProductQ } : {}),
                    ...(storeParams.storeProductAvailability !== "ALL"
                      ? { storeProductAvailability: storeParams.storeProductAvailability }
                      : {}),
                    ...(storeParams.storeProductPromotion !== "ALL"
                      ? { storeProductPromotion: storeParams.storeProductPromotion }
                      : {}),
                    ...(storeParams.storeProductSort !== "relevance"
                      ? { storeProductSort: storeParams.storeProductSort }
                      : {}),
                    ...(storeParams.storeProductPage > 1
                      ? { storeProductPage: String(storeParams.storeProductPage) }
                      : {}),
                  }).toString()}` as Route
                }
                nextHref={
                  `/loja/${store.slug}?${new URLSearchParams({
                    storeReviewPage: String(store.reviewPage + 1),
                    ...(storeParams.storeReviewSort !== "newest"
                      ? { storeReviewSort: storeParams.storeReviewSort }
                      : {}),
                    ...(storeParams.storeProductQ ? { storeProductQ: storeParams.storeProductQ } : {}),
                    ...(storeParams.storeProductAvailability !== "ALL"
                      ? { storeProductAvailability: storeParams.storeProductAvailability }
                      : {}),
                    ...(storeParams.storeProductPromotion !== "ALL"
                      ? { storeProductPromotion: storeParams.storeProductPromotion }
                      : {}),
                    ...(storeParams.storeProductSort !== "relevance"
                      ? { storeProductSort: storeParams.storeProductSort }
                      : {}),
                    ...(storeParams.storeProductPage > 1
                      ? { storeProductPage: String(storeParams.storeProductPage) }
                      : {}),
                  }).toString()}` as Route
                }
                className="sm:col-span-2 lg:col-span-3"
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {result.total === 0 ? (
        <Card className="border-[#e1dcd3] bg-white">
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">Esta loja ainda não possui produtos publicados.</p>
            <Link href="/products" className="text-primary mt-3 inline-block underline underline-offset-4">
              Explorar todo o catálogo
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-[#ae3e10] uppercase">Seleção da loja</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#1b1a18] sm:text-3xl">Produtos da vitrine</h2>
            </div>
            <p className="text-muted-foreground text-sm">
              {result.total} resultado{result.total === 1 ? "" : "s"}
            </p>
          </div>
          <form
            className="grid gap-3 rounded-2xl border border-[#e1dcd3] bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_auto] lg:items-end"
            method="get"
          >
            {storeParams.storeReviewPage > 1 ? (
              <input type="hidden" name="storeReviewPage" value={storeParams.storeReviewPage} />
            ) : null}
            {storeParams.storeReviewSort !== "newest" ? (
              <input type="hidden" name="storeReviewSort" value={storeParams.storeReviewSort} />
            ) : null}
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              Buscar produto
              <Input
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
              Promoção
              <DesignSelect
                aria-label="Promoção"
                name="storeProductPromotion"
                defaultValue={storeParams.storeProductPromotion}
              >
                <option value="ALL">Todas</option>
                <option value="ON_SALE">Em promoção</option>
              </DesignSelect>
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              Ordenar produtos
              <DesignSelect
                aria-label="Ordenar produtos"
                name="storeProductSort"
                defaultValue={storeParams.storeProductSort}
              >
                <option value="relevance">Relevância</option>
                <option value="newest">Mais recentes</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
              </DesignSelect>
            </label>
            <Button type="submit" className="w-full rounded-md px-4 sm:w-auto lg:mb-0">
              Aplicar
            </Button>
          </form>
          <ProductGrid products={result.products} />
          {result.pageCount > 1 ? (
            <Pagination
              ariaLabel="Paginação dos produtos da loja"
              page={result.page}
              pageCount={result.pageCount}
              previousHref={storePageHref(result.page - 1)}
              nextHref={storePageHref(result.page + 1)}
            />
          ) : null}
        </div>
      )}
    </main>
  );
}
