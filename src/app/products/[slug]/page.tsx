import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata, Route } from "next";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineNotice } from "@/components/ui/inline-notice";
import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { ProductShippingQuote } from "@/modules/checkout/components/product-shipping-quote";
import { FavoriteButton } from "@/modules/favorites/components/favorite-button";
import { isProductFavorited } from "@/modules/favorites/queries/favorites";
import { getPrimarySavedMotorcycle } from "@/modules/motorcycles/queries/saved-motorcycles";
import { buildProductJsonLd, serializeJsonLd } from "@/modules/products/application/build-product-json-ld";
import { ProductBreadcrumb } from "@/modules/products/components/detail/product-breadcrumb";
import { ProductBuyBox } from "@/modules/products/components/detail/product-buy-box";
import {
  formatFitmentLabel,
  ProductCompatibilityCard,
} from "@/modules/products/components/detail/product-compatibility-card";
import { ProductFitmentBanner, type FitmentStatus } from "@/modules/products/components/detail/product-fitment-banner";
import { ProductGallery } from "@/modules/products/components/detail/product-gallery";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";
import {
  getProductOfferSummary,
  getVariantStock,
  isVariantOnSale,
} from "@/modules/products/domain/product-offer-summary";
import { loadProductInteractionSearchParams } from "@/modules/products/interaction-search-params";
import { getApprovedProductBySlug, getApprovedProductSeoBySlug } from "@/modules/products/queries/products";
import { ProductQuestionsSection } from "@/modules/questions/components/product-questions-section";
import { ProductReviewsSection } from "@/modules/reviews/components/product-reviews-section";
import { averageRating, formatRating } from "@/modules/reviews/domain/rating";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

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
  const [product, session] = await Promise.all([getApprovedProductBySlug(slug, interactionParams), getCurrentSession()]);
  if (!product) notFound();

  const [isFavorite, primaryMotorcycle] = session
    ? await Promise.all([isProductFavorited(session.user.id, product.id), getPrimarySavedMotorcycle(session.user.id)])
    : [false, null];

  const productPath = `/products/${product.slug}`;
  const offer = getProductOfferSummary(product.variants);
  const productRating = product.productReviewAverage;
  const sellerRating = averageRating(product.seller.sellerReviews);
  const categoryLabel = getCategoryLabel(product.category);
  const galleryImages = product.images.flatMap((image) => {
    const url = getPublicStorageUrl(image.storageKey);
    return url ? [{ id: image.id, url, alt: image.altText ?? product.name }] : [];
  });
  const jsonLd = buildProductJsonLd(
    {
      name: product.name,
      slug: product.slug,
      description: product.description,
      category: product.category,
      brand: product.brand,
      variantCount: product.variants.length,
      imageUrls: galleryImages.map((image) => image.url),
      reviewAverage: productRating,
      reviewCount: product.productReviewCount,
    },
    offer,
    getApplicationBaseUrl(),
  );
  const fitmentStatus: FitmentStatus = primaryMotorcycle
    ? {
        kind:
          product.compatibilities.length === 0
            ? "unknown"
            : product.compatibilities.some(
                  (compatibility) => compatibility.motorcycleFitmentId === primaryMotorcycle.motorcycleFitmentId,
                )
              ? "fits"
              : "does-not-fit",
        motorcycleLabel: formatFitmentLabel(primaryMotorcycle.motorcycleFitment),
      }
    : { kind: "no-motorcycle", signedIn: Boolean(session), productPath };
  const buyBoxVariants = product.variants.map((variant) => ({
    id: variant.id,
    title: variant.title,
    sku: variant.sku,
    priceInCents: variant.priceInCents,
    currentPriceInCents: getCurrentPriceInCents(variant),
    onSale: isVariantOnSale(variant),
    stock: getVariantStock(variant),
  }));

  // pb extra no mobile: espaço para a barra fixa de "Adicionar" (ProductBuyBox).
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-8 pb-28 sm:px-6 sm:pt-12 md:pb-12">
      {!product.isDemo ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      ) : null}
      <ProductBreadcrumb category={{ slug: product.category.slug, label: categoryLabel }} productName={product.name} />

      <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start lg:gap-8">
        <ProductGallery images={galleryImages} productName={product.name} isDemo={product.isDemo} />

        <section
          className="border-border bg-card min-w-0 rounded-3xl border p-5 shadow-[0_16px_50px_-36px_rgba(0,0,0,0.4)] sm:p-7"
          aria-labelledby="product-title"
        >
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{categoryLabel}</Badge>
            <Badge variant="neutral">{product.brand.name}</Badge>
            {offer.hasPromotion ? <Badge className="bg-moto-brand text-moto-brand-foreground border-0">Oferta</Badge> : null}
            {product.seller.subscriptions.length > 0 ? <Badge variant="brand">Patrocinado · Loja VIP</Badge> : null}
          </div>
          <h1 id="product-title" className="text-foreground mt-5 text-3xl leading-tight sm:text-4xl">
            {product.name}
          </h1>
          <p className="text-muted-foreground mt-3 text-sm">
            Vendido por{" "}
            {product.seller.store ? (
              <Link
                className="text-brand-strong font-semibold underline-offset-4 hover:underline"
                href={`/loja/${product.seller.store.slug}` as Route}
              >
                {product.seller.store.name}
              </Link>
            ) : (
              <span>loja parceira</span>
            )}
          </p>
          {productRating || sellerRating || (!product.isDemo && product.unitsSold > 0) ? (
            <p className="text-muted-foreground mt-2 flex flex-wrap gap-x-2 text-xs">
              {productRating ? (
                <a href="#avaliacoes" className="hover:text-foreground underline-offset-4 hover:underline">
                  Produto {formatRating(productRating)}/5 ({product.productReviewCount})
                </a>
              ) : null}
              {sellerRating ? <span>Loja {formatRating(sellerRating)}/5</span> : null}
              {!product.isDemo && product.unitsSold > 0 ? (
                <span>
                  {product.unitsSold} {product.unitsSold === 1 ? "unidade vendida" : "unidades vendidas"}
                </span>
              ) : null}
            </p>
          ) : null}

          <div className="border-border mt-6 border-t">
            <ProductBuyBox
              variants={buyBoxVariants}
              isDemo={product.isDemo}
              hasPriceRange={offer.hasPriceRange}
              fitment={<ProductFitmentBanner status={fitmentStatus} />}
            />
          </div>
          {product.isDemo ? (
            <InlineNotice tone="warning" className="mt-5">
              Produto de apresentação. Imagens, valores e estoque são ilustrativos; a compra está desativada.
            </InlineNotice>
          ) : (
            <ProductShippingQuote
              options={buyBoxVariants.map((variant) => ({
                id: variant.id,
                title: variant.title,
                available: variant.stock > 0,
              }))}
            />
          )}
          <div className="border-border mt-5 border-t pt-5">
            {session ? (
              <FavoriteButton productId={product.id} initialIsFavorite={isFavorite} />
            ) : (
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={`/login?next=${encodeURIComponent(productPath)}` as Route}
              >
                Entre para favoritar
              </Link>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-xl">Sobre este produto</h2>
            </CardTitle>
            <CardDescription>Detalhes fornecidos pela loja.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="leading-7 whitespace-pre-line">{product.description}</p>
          </CardContent>
        </Card>
        <ProductCompatibilityCard
          compatibilities={product.compatibilities}
          primaryFitmentId={primaryMotorcycle?.motorcycleFitmentId ?? null}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <ProductReviewsSection
          slug={product.slug}
          params={interactionParams}
          reviews={product.productReviews}
          average={productRating}
          reviewCount={product.productReviewCount}
          page={product.reviewPage}
          pageCount={product.reviewPageCount}
        />
        <ProductQuestionsSection
          slug={product.slug}
          productId={product.id}
          params={interactionParams}
          questions={product.questions}
          questionCount={product.questionCount}
          page={product.questionPage}
          pageCount={product.questionPageCount}
          signedIn={Boolean(session)}
        />
      </div>
    </main>
  );
}
