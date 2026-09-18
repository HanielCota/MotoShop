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
    description: store.description ?? `Produtos da loja ${store.name} no marketplace MotoShop.`,
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

  function storePageHref(productPage: number): Route {
    const query = new URLSearchParams();
    if (storeParams.storeReviewPage > 1) query.set("storeReviewPage", String(storeParams.storeReviewPage));
    if (storeParams.storeReviewSort !== "newest") query.set("storeReviewSort", storeParams.storeReviewSort);
    if (storeParams.storeProductQ) query.set("storeProductQ", storeParams.storeProductQ);
    if (storeParams.storeProductAvailability !== "ALL") query.set("storeProductAvailability", storeParams.storeProductAvailability);
    if (storeParams.storeProductPromotion !== "ALL") query.set("storeProductPromotion", storeParams.storeProductPromotion);
    if (storeParams.storeProductSort !== "relevance") query.set("storeProductSort", storeParams.storeProductSort);
    if (productPage > 1) query.set("storeProductPage", String(productPage));
    const serialized = query.toString();
    return (serialized ? `/loja/${storeSlug}?${serialized}` : `/loja/${storeSlug}`) as Route;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      {store.bannerUrl ? (
        <div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl border">
          <Image
            src={store.bannerUrl}
            alt={`Banner da loja ${store.name}`}
            fill
            priority
            unoptimized
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 1152px"
          />
        </div>
      ) : null}
      <div>
        <div className="flex items-center gap-4">
          {store.logoUrl ? (
            <Image
              src={store.logoUrl}
              alt={`Logo da loja ${store.name}`}
              width={80}
              height={80}
              unoptimized
              className="size-16 rounded-xl border object-cover sm:size-20"
            />
          ) : null}
          <div>
            <Badge variant="secondary">Loja no MotoShop</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">{store.name}</h1>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          {store.description ?? "Catálogo aprovado desta loja dentro do marketplace de motocross."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {rating ? <span className="font-medium">★ {rating.toFixed(1)}/5</span> : null}
          <span className="text-muted-foreground">
            {store.reviewSummary.count} avaliação(ões) · {result.total} produto(s)
          </span>
          {store.seller.subscriptions.length > 0 ? <Badge>Seller VIP</Badge> : null}
        </div>
      </div>

      {store.reviewSummary.count > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Avaliações da loja</CardTitle>
            <CardDescription>
              Comentários de clientes que compraram no MotoShop · nota média {rating?.toFixed(1)}/5
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <form className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-3" method="get">
              {storeParams.storeProductSort !== "relevance" ? <input type="hidden" name="storeProductSort" value={storeParams.storeProductSort} /> : null}
              {storeParams.storeProductQ ? <input type="hidden" name="storeProductQ" value={storeParams.storeProductQ} /> : null}
              {storeParams.storeProductAvailability !== "ALL" ? <input type="hidden" name="storeProductAvailability" value={storeParams.storeProductAvailability} /> : null}
              {storeParams.storeProductPromotion !== "ALL" ? <input type="hidden" name="storeProductPromotion" value={storeParams.storeProductPromotion} /> : null}
              {storeParams.storeProductPage > 1 ? <input type="hidden" name="storeProductPage" value={storeParams.storeProductPage} /> : null}
              <label className="flex flex-col gap-2 text-sm font-medium">
                Ordenar avaliações
                <select className="border-input bg-background h-10 rounded-md border px-3 text-sm" name="storeReviewSort" defaultValue={storeParams.storeReviewSort}>
                  <option value="newest">Mais recentes</option>
                  <option value="oldest">Mais antigas</option>
                </select>
              </label>
              <button className="bg-primary text-primary-foreground h-10 rounded-md px-4 text-sm font-medium">Aplicar</button>
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
              <nav className="flex items-center justify-between gap-3 sm:col-span-2 lg:col-span-3" aria-label="Paginação das avaliações da loja">
                {store.reviewPage > 1 ? (
                  <Link
                    href={`/loja/${store.slug}?${new URLSearchParams({
                      storeReviewPage: String(store.reviewPage - 1),
                      ...(storeParams.storeReviewSort !== "newest" ? { storeReviewSort: storeParams.storeReviewSort } : {}),
                      ...(storeParams.storeProductQ ? { storeProductQ: storeParams.storeProductQ } : {}),
                      ...(storeParams.storeProductAvailability !== "ALL" ? { storeProductAvailability: storeParams.storeProductAvailability } : {}),
                      ...(storeParams.storeProductPromotion !== "ALL" ? { storeProductPromotion: storeParams.storeProductPromotion } : {}),
                      ...(storeParams.storeProductSort !== "relevance" ? { storeProductSort: storeParams.storeProductSort } : {}),
                      ...(storeParams.storeProductPage > 1 ? { storeProductPage: String(storeParams.storeProductPage) } : {}),
                    }).toString()}` as Route}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    Anterior
                  </Link>
                ) : <span />}
                <span className="text-muted-foreground text-xs">Página {store.reviewPage} de {store.reviewPageCount}</span>
                {store.reviewPage < store.reviewPageCount ? (
                  <Link
                    href={`/loja/${store.slug}?${new URLSearchParams({
                      storeReviewPage: String(store.reviewPage + 1),
                      ...(storeParams.storeReviewSort !== "newest" ? { storeReviewSort: storeParams.storeReviewSort } : {}),
                      ...(storeParams.storeProductQ ? { storeProductQ: storeParams.storeProductQ } : {}),
                      ...(storeParams.storeProductAvailability !== "ALL" ? { storeProductAvailability: storeParams.storeProductAvailability } : {}),
                      ...(storeParams.storeProductPromotion !== "ALL" ? { storeProductPromotion: storeParams.storeProductPromotion } : {}),
                      ...(storeParams.storeProductSort !== "relevance" ? { storeProductSort: storeParams.storeProductSort } : {}),
                      ...(storeParams.storeProductPage > 1 ? { storeProductPage: String(storeParams.storeProductPage) } : {}),
                    }).toString()}` as Route}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    Próxima
                  </Link>
                ) : <span />}
              </nav>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {result.total === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">Esta loja ainda não possui produtos publicados.</p>
            <Link href="/products" className="text-primary mt-3 inline-block underline underline-offset-4">
              Explorar todo o catálogo
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <form className="flex flex-wrap items-end gap-3 rounded-xl border p-4" method="get">
            {storeParams.storeReviewPage > 1 ? <input type="hidden" name="storeReviewPage" value={storeParams.storeReviewPage} /> : null}
            {storeParams.storeReviewSort !== "newest" ? <input type="hidden" name="storeReviewSort" value={storeParams.storeReviewSort} /> : null}
            <label className="flex min-w-64 flex-col gap-2 text-sm font-medium">
              Buscar produto
              <input className="border-input bg-background h-10 rounded-md border px-3 text-sm" name="storeProductQ" defaultValue={storeParams.storeProductQ ?? ""} placeholder="Nome, marca, categoria ou SKU" />
            </label>
            <label className="flex min-w-48 flex-col gap-2 text-sm font-medium">
              Disponibilidade
              <select className="border-input bg-background h-10 rounded-md border px-3 text-sm" name="storeProductAvailability" defaultValue={storeParams.storeProductAvailability}>
                <option value="ALL">Todos</option>
                <option value="IN_STOCK">Em estoque</option>
                <option value="OUT_OF_STOCK">Indisponíveis</option>
              </select>
            </label>
            <label className="flex min-w-48 flex-col gap-2 text-sm font-medium">
              Promoção
              <select className="border-input bg-background h-10 rounded-md border px-3 text-sm" name="storeProductPromotion" defaultValue={storeParams.storeProductPromotion}>
                <option value="ALL">Todas</option>
                <option value="ON_SALE">Em promoção</option>
              </select>
            </label>
            <label className="flex min-w-56 flex-col gap-2 text-sm font-medium">
              Ordenar produtos
              <select className="border-input bg-background h-10 rounded-md border px-3 text-sm" name="storeProductSort" defaultValue={storeParams.storeProductSort}>
                <option value="relevance">Relevância</option>
                <option value="newest">Mais recentes</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
              </select>
            </label>
            <button className="bg-primary text-primary-foreground h-10 rounded-md px-4 text-sm font-medium">Aplicar</button>
          </form>
          <ProductGrid products={result.products} />
          {result.pageCount > 1 ? (
            <nav className="flex items-center justify-between gap-3" aria-label="Paginação dos produtos da loja">
              {result.page > 1 ? (
                <Link href={storePageHref(result.page - 1)} className="rounded-md border px-3 py-2 text-sm">
                  Anterior
                </Link>
              ) : <span />}
              <span className="text-muted-foreground text-xs">Página {result.page} de {result.pageCount}</span>
              {result.page < result.pageCount ? (
                <Link href={storePageHref(result.page + 1)} className="rounded-md border px-3 py-2 text-sm">
                  Próxima
                </Link>
              ) : <span />}
            </nav>
          ) : null}
        </div>
      )}
    </main>
  );
}
