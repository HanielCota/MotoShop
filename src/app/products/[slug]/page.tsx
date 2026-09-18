import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Route } from "next";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatMoneyInCents } from "@/lib/utils";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { AddToCartButton } from "@/modules/cart/components/add-to-cart-button";
import { FavoriteButton } from "@/modules/favorites/components/favorite-button";
import { isProductFavorited } from "@/modules/favorites/queries/favorites";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";
import { AskQuestionForm } from "@/modules/questions/components/ask-question-form";
import { getApprovedProductBySlug, getApprovedProductSeoBySlug } from "@/modules/products/queries/products";
import { loadProductInteractionSearchParams } from "@/modules/products/interaction-search-params";
import { env } from "@/config/env";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

function averageRating(reviews: { rating: number }[]) {
  if (reviews.length === 0) return null;
  return reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getApprovedProductSeoBySlug(slug);
  if (!product) return { title: "Produto não encontrado" };

  const image = product.images[0] ? getPublicStorageUrl(product.images[0].storageKey) : undefined;
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description: product.description.slice(0, 160),
      url: `/products/${product.slug}`,
      ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
    },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const interactionParams = await loadProductInteractionSearchParams(searchParams);
  const [product, session] = await Promise.all([
    getApprovedProductBySlug(slug, interactionParams),
    getCurrentSession(),
  ]);
  if (!product) notFound();

  const isFavorite = session ? await isProductFavorited(session.user.id, product.id) : false;
  const productRating = product.productReviewAverage;
  const sellerRating = averageRating(product.seller.sellerReviews);
  const prices = product.variants.map((variant) => getCurrentPriceInCents(variant));
  const hasStock = product.variants.some((variant) => (variant.inventory?.availableQuantity ?? 0) > 0);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    category: product.category.name,
    brand: { "@type": "Brand", name: product.brand.name },
    image: product.images.map((image) => getPublicStorageUrl(image.storageKey)).filter(Boolean),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "BRL",
      lowPrice: prices.length > 0 ? Math.min(...prices) / 100 : undefined,
      highPrice: prices.length > 0 ? Math.max(...prices) / 100 : undefined,
      offerCount: product.variants.length,
      availability: `https://schema.org/${hasStock ? "InStock" : "OutOfStock"}`,
      url: `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/products/${product.slug}`,
    },
    ...(productRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: productRating,
            reviewCount: product.productReviewCount,
          },
        }
      : {}),
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Link className="text-muted-foreground text-sm underline underline-offset-4" href="/products">
        ← Voltar para produtos
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{product.category.name}</Badge>
              <Badge variant="secondary">{product.brand.name}</Badge>
              {product.seller.subscriptions.length > 0 ? <Badge>Patrocinado · VIP</Badge> : null}
            </div>
            <CardTitle className="text-3xl">{product.name}</CardTitle>
            <CardDescription>
              Vendido por{" "}
              {product.seller.store ? (
                <Link className="hover:underline" href={`/loja/${product.seller.store.slug}` as Route}>
                  {product.seller.store.name}
                </Link>
              ) : null}
              {productRating ? ` · Produto ${productRating.toFixed(1)}/5 (${product.productReviews.length})` : ""}
              {sellerRating ? ` · Seller ${sellerRating.toFixed(1)}/5` : ""}
            </CardDescription>
            <div className="pt-2">
              {session ? (
                <FavoriteButton productId={product.id} initialIsFavorite={isFavorite} />
              ) : (
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={`/login?next=${encodeURIComponent(`/products/${product.slug}`)}` as Route}
                >
                  Entre para favoritar
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {product.images.length > 0 ? (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {product.images.map((image) => {
                  const imageUrl = getPublicStorageUrl(image.storageKey);
                  return imageUrl ? (
                    <Image
                      key={image.id}
                      src={imageUrl}
                      alt={image.altText ?? product.name}
                      width={640}
                      height={640}
                      unoptimized
                      className="aspect-square w-full rounded-lg border object-cover"
                    />
                  ) : null;
                })}
              </div>
            ) : null}
            <p className="leading-7">{product.description}</p>
            <div className="mt-6">
              <h2 className="font-semibold">Compatibilidade</h2>
              {product.compatibilities.length === 0 ? (
                <p className="text-muted-foreground mt-2 text-sm">Compatibilidade ainda não informada.</p>
              ) : (
                <ul className="text-muted-foreground mt-2 flex flex-wrap gap-2 text-sm">
                  {product.compatibilities.map((compatibility) => (
                    <li key={compatibility.id} className="rounded-full border px-3 py-1">
                      <Link
                        className="hover:underline"
                        href={
                          `/moto/${compatibility.motorcycleFitment.motorcycleModel.manufacturer.slug}/${compatibility.motorcycleFitment.motorcycleModel.slug}/${compatibility.motorcycleFitment.year}` as Route
                        }
                      >
                        {compatibility.motorcycleFitment.motorcycleModel.manufacturer.name}{" "}
                        {compatibility.motorcycleFitment.motorcycleModel.name} · {compatibility.motorcycleFitment.year}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Opções</CardTitle>
            <CardDescription>Escolha uma variante disponível.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {product.variants.map((variant) => {
              const stock = variant.inventory?.availableQuantity ?? 0;
              return (
                <div key={variant.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{variant.title}</span>
                    <span className="font-semibold">{formatMoneyInCents(getCurrentPriceInCents(variant))}</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    SKU {variant.sku} · {stock > 0 ? `${stock} em estoque` : "Indisponível"}
                  </p>
                  <AddToCartButton variantId={variant.id} disabled={stock < 1} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Avaliações do produto</CardTitle>
            <CardDescription>
              {productRating
                ? `${productRating.toFixed(1)}/5 com ${product.productReviewCount} avaliação(ões)`
                : "Este produto ainda não tem avaliações."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-wrap items-end gap-3 rounded-md border p-3" method="get">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Filtrar por nota
                <select className="border-input bg-background h-9 rounded-md border px-3 text-sm" name="reviewRating" defaultValue={interactionParams.reviewRating ?? ""}>
                  <option value="">Todas as notas</option>
                  {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} estrela{rating === 1 ? "" : "s"}</option>)}
                </select>
              </label>
              {interactionParams.questionSort !== "newest" ? <input type="hidden" name="questionSort" value={interactionParams.questionSort} /> : null}
              {interactionParams.questionPage > 1 ? <input type="hidden" name="questionPage" value={interactionParams.questionPage} /> : null}
              <label className="flex flex-col gap-1 text-sm font-medium">
                Ordenar avaliações
                <select className="border-input bg-background h-9 rounded-md border px-3 text-sm" name="reviewSort" defaultValue={interactionParams.reviewSort}>
                  <option value="newest">Mais recentes</option>
                  <option value="oldest">Mais antigas</option>
                </select>
              </label>
              <button className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm font-medium">Filtrar</button>
            </form>
            {product.productReviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                As primeiras avaliações aparecerão aqui após compras verificadas.
              </p>
            ) : (
              product.productReviews.map((review) => (
                <article key={review.id} className="border-border border-b pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <strong>
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </strong>
                    <span className="text-muted-foreground text-xs">{review.user.name ?? "Cliente"}</span>
                  </div>
                  {review.comment ? <p className="mt-2 text-sm text-slate-700">{review.comment}</p> : null}
                </article>
              ))
            )}
            {product.reviewPageCount > 1 ? (
              <nav className="flex items-center justify-between gap-3 pt-2" aria-label="Paginação de avaliações">
                {product.reviewPage > 1 ? (
                  <Link
                    href={interactionHref(slug, interactionParams, product.reviewPage - 1, undefined)}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-muted-foreground text-xs">
                  Página {product.reviewPage} de {product.reviewPageCount}
                </span>
                {product.reviewPage < product.reviewPageCount ? (
                  <Link
                    href={interactionHref(slug, interactionParams, product.reviewPage + 1, undefined)}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    Próxima
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dúvidas sobre o produto</CardTitle>
            <CardDescription>Veja respostas do seller e ajude a comunidade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-wrap items-end gap-3 rounded-md border p-3" method="get">
              {interactionParams.reviewRating ? <input type="hidden" name="reviewRating" value={interactionParams.reviewRating} /> : null}
              {interactionParams.reviewSort !== "newest" ? <input type="hidden" name="reviewSort" value={interactionParams.reviewSort} /> : null}
              {interactionParams.reviewPage > 1 ? <input type="hidden" name="reviewPage" value={interactionParams.reviewPage} /> : null}
              <label className="flex flex-col gap-1 text-sm font-medium">
                Ordenar perguntas
                <select className="border-input bg-background h-9 rounded-md border px-3 text-sm" name="questionSort" defaultValue={interactionParams.questionSort}>
                  <option value="newest">Mais recentes</option>
                  <option value="oldest">Mais antigas</option>
                </select>
              </label>
              <button className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm font-medium">Aplicar</button>
            </form>
            {product.questions.length === 0 ? (
              <p className="text-muted-foreground text-sm">Ainda não há perguntas. Seja o primeiro a perguntar.</p>
            ) : (
              product.questions.map((question) => (
                <article key={question.id} className="border-border border-b pb-4 last:border-b-0 last:pb-0">
                  <p className="font-medium">{question.question}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Perguntado por {question.askedBy.name ?? "Cliente"}
                  </p>
                  {question.answer ? (
                    <div className="bg-muted/40 mt-3 rounded-md p-3 text-sm">
                      <p className="font-medium">Resposta do seller</p>
                      <p className="mt-1 text-slate-700">{question.answer}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground mt-3 text-sm">Aguardando resposta do seller.</p>
                  )}
                </article>
              ))
            )}
            {product.questionPageCount > 1 ? (
              <nav className="flex items-center justify-between gap-3 pt-2" aria-label="Paginação de perguntas">
                {product.questionPage > 1 ? (
                  <Link
                    href={interactionHref(slug, interactionParams, undefined, product.questionPage - 1)}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-muted-foreground text-xs">
                  Página {product.questionPage} de {product.questionPageCount}
                </span>
                {product.questionPage < product.questionPageCount ? (
                  <Link
                    href={interactionHref(slug, interactionParams, undefined, product.questionPage + 1)}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    Próxima
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
            {session ? (
              <AskQuestionForm productId={product.id} />
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                <Link href={`/login?next=/products/${product.slug}`} className="text-primary font-semibold underline">
                  Entre na sua conta
                </Link>{" "}
                para fazer uma pergunta.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function interactionHref(
  slug: string,
  params: { reviewRating: number | null; reviewSort: "newest" | "oldest"; reviewPage: number; questionPage: number; questionSort: "newest" | "oldest" },
  reviewPage?: number,
  questionPage?: number,
): Route {
  const query = new URLSearchParams();
  const nextReviewPage = reviewPage ?? params.reviewPage;
  const nextQuestionPage = questionPage ?? params.questionPage;
  if (params.reviewRating !== null && params.reviewRating !== undefined) query.set("reviewRating", String(params.reviewRating));
  if (params.reviewSort !== "newest") query.set("reviewSort", params.reviewSort);
  if (params.questionSort !== "newest") query.set("questionSort", params.questionSort);
  if (nextReviewPage > 1) query.set("reviewPage", String(nextReviewPage));
  if (nextQuestionPage > 1) query.set("questionPage", String(nextQuestionPage));
  const serialized = query.toString();
  return (serialized ? `/products/${slug}?${serialized}` : `/products/${slug}`) as Route;
}
