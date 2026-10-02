import { Pagination } from "@/components/ui/pagination";
import { DesignSelect } from "@/components/ui/design-select";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Route } from "next";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/inline-notice";
import { formatMoneyInCents } from "@/lib/utils";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { AddToCartButton } from "@/modules/cart/components/add-to-cart-button";
import { FavoriteButton } from "@/modules/favorites/components/favorite-button";
import { isProductFavorited } from "@/modules/favorites/queries/favorites";
import { getCurrentPriceInCents, hasActivePromotion } from "@/modules/products/domain/pricing";
import { AskQuestionForm } from "@/modules/questions/components/ask-question-form";
import { getApprovedProductBySlug, getApprovedProductSeoBySlug } from "@/modules/products/queries/products";
import { loadProductInteractionSearchParams } from "@/modules/products/interaction-search-params";
import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { getPrimarySavedMotorcycle } from "@/modules/motorcycles/queries/saved-motorcycles";
import { ProductShippingQuote } from "@/modules/checkout/components/product-shipping-quote";

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
    ...(product.isDemo ? { robots: { index: false, follow: false } } : {}),
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

  const [isFavorite, primaryMotorcycle] = session
    ? await Promise.all([isProductFavorited(session.user.id, product.id), getPrimarySavedMotorcycle(session.user.id)])
    : [false, null];
  const matchesPrimaryMotorcycle = primaryMotorcycle
    ? product.compatibilities.some(
        (compatibility) => compatibility.motorcycleFitmentId === primaryMotorcycle.motorcycleFitmentId,
      )
    : false;
  const productRating = product.productReviewAverage;
  const sellerRating = averageRating(product.seller.sellerReviews);
  const prices = product.variants.map((variant) => getCurrentPriceInCents(variant));
  const hasStock = product.variants.some((variant) => (variant.inventory?.availableQuantity ?? 0) > 0);
  const lowestPriceInCents = prices.length > 0 ? Math.min(...prices) : null;
  const hasPriceRange = new Set(prices).size > 1;
  const galleryImages = product.images.flatMap((image) => {
    const url = getPublicStorageUrl(image.storageKey);
    return url ? [{ id: image.id, url, alt: image.altText ?? product.name }] : [];
  });
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
      url: `${getApplicationBaseUrl()}/products/${product.slug}`,
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      {!product.isDemo ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      ) : null}
      <nav
        aria-label="Navegação estrutural"
        className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs sm:text-sm"
      >
        <Link href="/products" className="hover:text-foreground shrink-0 hover:underline">
          Catálogo
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href={`/categoria/${product.category.slug}` as Route}
          className="hover:text-foreground shrink-0 hover:underline"
        >
          {getCategoryLabel(product.category)}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground truncate" aria-current="page">
          {product.name}
        </span>
      </nav>

      <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start lg:gap-8">
        <div className="min-w-0">
          <div className="relative aspect-[6/5] overflow-hidden rounded-[1.5rem] border border-[#e1dcd3] bg-[#eae7e0] sm:aspect-square">
            {galleryImages[0] ? (
              <Image
                src={galleryImages[0].url}
                alt={galleryImages[0].alt}
                fill
                priority
                unoptimized
                sizes="(max-width: 767px) 100vw, 50vw"
                className="object-contain"
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm">
                Imagem do produto em preparação
              </div>
            )}
            {product.isDemo ? (
              <span className="absolute top-4 left-4 rounded-full bg-[#1b1a18] px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-white uppercase shadow-sm">
                Demonstração
              </span>
            ) : null}
          </div>
          {galleryImages.length > 1 ? (
            <div className="mt-3 grid grid-cols-4 gap-3" aria-label="Outras imagens do produto">
              {galleryImages.slice(1).map((image) => (
                <div
                  key={image.id}
                  className="relative aspect-square overflow-hidden rounded-xl border border-[#e1dcd3] bg-[#eae7e0]"
                >
                  <Image src={image.url} alt={image.alt} fill unoptimized sizes="120px" className="object-contain" />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <section
          className="min-w-0 rounded-[1.5rem] border border-[#e1dcd3] bg-white p-5 shadow-[0_16px_50px_-36px_rgba(0,0,0,0.4)] sm:p-7"
          aria-labelledby="product-title"
        >
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{getCategoryLabel(product.category)}</Badge>
            <Badge variant="secondary">{product.brand.name}</Badge>
            {product.variants.some(
              (variant) => hasActivePromotion(variant) && variant.promotionalPriceInCents! < variant.priceInCents,
            ) ? (
              <Badge className="bg-moto-brand text-moto-brand-foreground border-0">Oferta</Badge>
            ) : null}
            {product.seller.subscriptions.length > 0 ? <Badge>Patrocinado · VIP</Badge> : null}
          </div>
          <h1
            id="product-title"
            className="mt-5 text-3xl leading-tight font-bold tracking-tight text-[#1b1a18] sm:text-4xl"
          >
            {product.name}
          </h1>
          <p className="text-muted-foreground mt-3 text-sm">
            Vendido por{" "}
            {product.seller.store ? (
              <Link
                className="font-semibold text-[#ad3b0d] underline-offset-4 hover:underline"
                href={`/loja/${product.seller.store.slug}` as Route}
              >
                {product.seller.store.name}
              </Link>
            ) : (
              <span>loja parceira</span>
            )}
          </p>
          {productRating || sellerRating ? (
            <p className="text-muted-foreground mt-2 text-xs">
              {productRating ? `Produto ${productRating.toFixed(1)}/5 (${product.productReviewCount})` : ""}
              {productRating && sellerRating ? " · " : ""}
              {sellerRating ? `Loja ${sellerRating.toFixed(1)}/5` : ""}
            </p>
          ) : null}
          {!product.isDemo && product.unitsSold > 0 ? (
            <p className="text-muted-foreground mt-2 text-xs">
              {product.unitsSold} {product.unitsSold === 1 ? "unidade vendida" : "unidades vendidas"}
            </p>
          ) : null}

          <div className="mt-6 border-t border-[#ece8e1] pt-5">
            {lowestPriceInCents !== null ? (
              <div>
                {hasPriceRange ? <p className="text-muted-foreground text-xs">A partir de</p> : null}
                <p className="text-3xl font-bold tracking-tight text-[#1b1a18] sm:text-4xl">
                  {formatMoneyInCents(lowestPriceInCents)}
                </p>
                {product.isDemo ? <p className="mt-1 text-xs font-medium text-[#a33b10]">Valor ilustrativo</p> : null}
              </div>
            ) : null}
            {product.isDemo ? (
              <InlineNotice tone="warning" className="mt-5">
                Produto de apresentação. Imagens, valores e estoque são ilustrativos; a compra está desativada.
              </InlineNotice>
            ) : null}
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#1b1a18]">Escolha sua opção</h2>
              <span className="text-muted-foreground text-xs">
                {product.variants.length} {product.variants.length === 1 ? "opção" : "opções"}
              </span>
            </div>
            {product.variants.map((variant) => {
              const stock = variant.inventory?.availableQuantity ?? 0;
              return (
                <div key={variant.id} className="rounded-xl border border-[#e4dfd5] bg-[#faf9f6] p-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold">{variant.title}</span>
                    <span className="text-sm font-bold">{formatMoneyInCents(getCurrentPriceInCents(variant))}</span>
                  </div>
                  {hasActivePromotion(variant) && variant.promotionalPriceInCents! < variant.priceInCents ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      <span className="mr-2 line-through">{formatMoneyInCents(variant.priceInCents)}</span>
                      <span className="text-moto-brand-strong font-semibold">Preço promocional</span>
                    </p>
                  ) : null}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {product.isDemo
                      ? `SKU ${variant.sku} · exemplo ilustrativo`
                      : `SKU ${variant.sku} · ${stock > 0 ? `${stock} em estoque` : "Indisponível"}`}
                  </p>
                  {!product.isDemo && stock > 0 && stock <= 5 ? (
                    <p className="mt-1 text-xs font-semibold text-amber-800">Restam {stock} unidades desta opção</p>
                  ) : null}
                  {!product.isDemo ? <AddToCartButton variantId={variant.id} disabled={stock < 1} /> : null}
                </div>
              );
            })}
          </div>
          {!product.isDemo ? (
            <ProductShippingQuote
              options={product.variants.map((variant) => ({
                id: variant.id,
                title: variant.title,
                available: (variant.inventory?.availableQuantity ?? 0) > 0,
              }))}
            />
          ) : null}
          <div className="mt-5 border-t border-[#ece8e1] pt-5">
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
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-[#e1dcd3] bg-white">
          <CardHeader>
            <CardTitle>Sobre este produto</CardTitle>
            <CardDescription>Detalhes fornecidos pela loja.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="leading-7 whitespace-pre-line">{product.description}</p>
          </CardContent>
        </Card>
        <Card className="border-[#e1dcd3] bg-white">
          <CardHeader>
            <CardTitle>Compatibilidade com motos</CardTitle>
            <CardDescription>Confira a configuração antes de escolher uma peça.</CardDescription>
          </CardHeader>
          <CardContent>
            {primaryMotorcycle ? (
              <div className="rounded-lg border border-[#f4c8ad] bg-[#fff4eb] p-3 text-sm">
                <p className="font-semibold">
                  {matchesPrimaryMotorcycle
                    ? "Compatibilidade cadastrada para sua moto principal"
                    : "Compatibilidade com sua moto principal não confirmada"}
                </p>
                <p className="mt-1 text-slate-700">
                  {primaryMotorcycle.motorcycleFitment.motorcycleModel.manufacturer.name}{" "}
                  {primaryMotorcycle.motorcycleFitment.motorcycleModel.name} ·{" "}
                  {primaryMotorcycle.motorcycleFitment.year}
                  {primaryMotorcycle.motorcycleFitment.version
                    ? ` · ${primaryMotorcycle.motorcycleFitment.version}`
                    : ""}
                  .{" "}
                  {matchesPrimaryMotorcycle
                    ? "Confira também a versão e as informações do fabricante."
                    : "Confira as configurações listadas abaixo antes de comprar."}
                </p>
                <Link
                  href="/account/motorcycles"
                  className="mt-2 inline-block font-medium text-[#a63a0b] underline underline-offset-4"
                >
                  Trocar moto principal
                </Link>
              </div>
            ) : (
              <Link
                href="/account/motorcycles"
                className="inline-block text-sm font-medium text-[#a63a0b] underline underline-offset-4"
              >
                Salve sua moto para conferir a compatibilidade aqui
              </Link>
            )}
            {product.compatibilities.length === 0 ? (
              <p className="text-muted-foreground mt-3 text-sm">Compatibilidade ainda não informada.</p>
            ) : (
              <ul className="text-muted-foreground mt-4 flex flex-wrap gap-2 text-sm">
                {product.compatibilities.map((compatibility) => (
                  <li key={compatibility.id} className="rounded-full border px-3 py-1">
                    <Link
                      className="hover:underline"
                      href={`/products?moto=${encodeURIComponent(compatibility.motorcycleFitmentId)}` as Route}
                    >
                      {compatibility.motorcycleFitment.motorcycleModel.manufacturer.name}{" "}
                      {compatibility.motorcycleFitment.motorcycleModel.name} ·{" "}
                      {compatibility.motorcycleFitment.version || "padrão"} ·{" "}
                      {compatibility.motorcycleFitment.displacementCc} cc · {compatibility.motorcycleFitment.year}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
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
            {product.productReviewCount > 0 ? (
              <form className="flex flex-wrap items-end gap-3 rounded-md border p-3" method="get">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Nota mínima
                  <DesignSelect
                    aria-label="Filtrar por nota"
                    className="h-9"
                    name="reviewRating"
                    defaultValue={interactionParams.reviewRating ?? ""}
                  >
                    <option value="">Todas as notas</option>
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <option key={rating} value={rating}>
                        {rating} estrela{rating === 1 ? "" : "s"} ou mais
                      </option>
                    ))}
                  </DesignSelect>
                </label>
                {interactionParams.questionSort !== "newest" ? (
                  <input type="hidden" name="questionSort" value={interactionParams.questionSort} />
                ) : null}
                {interactionParams.questionPage > 1 ? (
                  <input type="hidden" name="questionPage" value={interactionParams.questionPage} />
                ) : null}
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Ordenar avaliações
                  <DesignSelect
                    aria-label="Ordenar avaliações"
                    className="h-9"
                    name="reviewSort"
                    defaultValue={interactionParams.reviewSort}
                  >
                    <option value="newest">Mais recentes</option>
                    <option value="oldest">Mais antigas</option>
                  </DesignSelect>
                </label>
                <Button type="submit" size="sm" className="rounded-md px-4">
                  Filtrar
                </Button>
              </form>
            ) : null}
            {product.productReviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                As primeiras avaliações aparecerão aqui após compras verificadas.
              </p>
            ) : (
              product.productReviews.map((review) => (
                <article key={review.id} className="border-border border-b pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <strong aria-label={`${(review.ratingTenths / 10).toFixed(1).replace(".", ",")} de 5 estrelas`}>
                      <span
                        aria-hidden="true"
                        className="relative inline-block leading-none whitespace-nowrap text-slate-300"
                      >
                        ★★★★★
                        <span
                          className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-amber-500"
                          style={{ width: `${review.ratingTenths * 2}%` }}
                        >
                          ★★★★★
                        </span>
                      </span>
                      <span className="ml-2 text-xs font-normal text-slate-600">
                        {(review.ratingTenths / 10).toFixed(1).replace(".", ",")}/5
                      </span>
                    </strong>
                    <span className="text-muted-foreground text-xs">{review.user.name ?? "Cliente"}</span>
                  </div>
                  {review.comment ? <p className="mt-2 text-sm text-slate-700">{review.comment}</p> : null}
                  {review.media.length ? (
                    <div className="mt-3 flex flex-wrap gap-2" aria-label="Fotos e vídeos da avaliação">
                      {review.media.map((media) => {
                        const url = getPublicStorageUrl(media.storageKey);
                        if (!url) return null;
                        return media.mediaType === "video" ? (
                          <video
                            key={media.id}
                            controls
                            preload="metadata"
                            className="max-h-56 max-w-full rounded-lg border bg-black"
                          >
                            <source src={url} type={media.contentType} />
                            Seu navegador não consegue reproduzir este vídeo.
                          </video>
                        ) : (
                          <a
                            key={media.id}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="relative size-24 overflow-hidden rounded-lg border bg-slate-100"
                          >
                            <Image
                              src={url}
                              alt="Foto anexada à avaliação"
                              fill
                              unoptimized
                              sizes="96px"
                              className="object-cover"
                            />
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              ))
            )}
            {product.reviewPageCount > 1 ? (
              <Pagination
                ariaLabel="Paginação de avaliações"
                page={product.reviewPage}
                pageCount={product.reviewPageCount}
                previousHref={interactionHref(slug, interactionParams, product.reviewPage - 1, undefined)}
                nextHref={interactionHref(slug, interactionParams, product.reviewPage + 1, undefined)}
                className="pt-2"
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dúvidas sobre o produto</CardTitle>
            <CardDescription>Veja respostas da loja e ajude a comunidade do motocross.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {product.questionCount > 0 ? (
              <form className="flex flex-wrap items-end gap-3 rounded-md border p-3" method="get">
                {interactionParams.reviewRating ? (
                  <input type="hidden" name="reviewRating" value={interactionParams.reviewRating} />
                ) : null}
                {interactionParams.reviewSort !== "newest" ? (
                  <input type="hidden" name="reviewSort" value={interactionParams.reviewSort} />
                ) : null}
                {interactionParams.reviewPage > 1 ? (
                  <input type="hidden" name="reviewPage" value={interactionParams.reviewPage} />
                ) : null}
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Ordenar perguntas
                  <DesignSelect
                    aria-label="Ordenar perguntas"
                    className="h-9"
                    name="questionSort"
                    defaultValue={interactionParams.questionSort}
                  >
                    <option value="newest">Mais recentes</option>
                    <option value="oldest">Mais antigas</option>
                  </DesignSelect>
                </label>
                <Button type="submit" size="sm" className="rounded-md px-4">
                  Aplicar
                </Button>
              </form>
            ) : null}
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
                      <p className="font-medium">Resposta da loja</p>
                      <p className="mt-1 text-slate-700">{question.answer}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground mt-3 text-sm">Aguardando resposta da loja.</p>
                  )}
                </article>
              ))
            )}
            {product.questionPageCount > 1 ? (
              <Pagination
                ariaLabel="Paginação de perguntas"
                page={product.questionPage}
                pageCount={product.questionPageCount}
                previousHref={interactionHref(slug, interactionParams, undefined, product.questionPage - 1)}
                nextHref={interactionHref(slug, interactionParams, undefined, product.questionPage + 1)}
                className="pt-2"
              />
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
  params: {
    reviewRating: number | null;
    reviewSort: "newest" | "oldest";
    reviewPage: number;
    questionPage: number;
    questionSort: "newest" | "oldest";
  },
  reviewPage?: number,
  questionPage?: number,
): Route {
  const query = new URLSearchParams();
  const nextReviewPage = reviewPage ?? params.reviewPage;
  const nextQuestionPage = questionPage ?? params.questionPage;
  if (params.reviewRating !== null && params.reviewRating !== undefined)
    query.set("reviewRating", String(params.reviewRating));
  if (params.reviewSort !== "newest") query.set("reviewSort", params.reviewSort);
  if (params.questionSort !== "newest") query.set("questionSort", params.questionSort);
  if (nextReviewPage > 1) query.set("reviewPage", String(nextReviewPage));
  if (nextQuestionPage > 1) query.set("questionPage", String(nextQuestionPage));
  const serialized = query.toString();
  return (serialized ? `/products/${slug}?${serialized}` : `/products/${slug}`) as Route;
}
