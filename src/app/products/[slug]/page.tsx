import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata, Route } from "next";

import { pageContainerClassName } from "@/components/ui/page-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND_SITE_NAME } from "@/config/brand";
import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { isUniversalCategory } from "@/modules/catalog/queries/universal-category";
import { ProductShippingQuote } from "@/modules/checkout/components/product-shipping-quote";
import { FavoriteButton } from "@/modules/favorites/components/favorite-button";
import { isProductFavorited } from "@/modules/favorites/queries/favorites";
import { ProductMotorcyclePicker } from "@/modules/motorcycles/components/product-motorcycle-picker";
import { listActiveMotorcycleFitments } from "@/modules/motorcycles/queries/motorcycles";
import { getPrimarySavedMotorcycle } from "@/modules/motorcycles/queries/saved-motorcycles";
import { buildProductJsonLd, serializeJsonLd } from "@/modules/products/application/build-product-json-ld";
import { ProductBreadcrumb } from "@/modules/products/components/detail/product-breadcrumb";
import { ProductBuyBox } from "@/modules/products/components/detail/product-buy-box";
import {
  formatFitmentLabel,
  ProductCompatibilityCard,
} from "@/modules/products/components/detail/product-compatibility-card";
import { ProductFitmentBanner } from "@/modules/products/components/detail/product-fitment-banner";
import { resolveFitmentStatus } from "@/modules/products/domain/fitment-status";
import { ProductDetailSkeleton } from "@/modules/products/components/detail/product-detail-skeleton";
import { ProductGallery } from "@/modules/products/components/detail/product-gallery";
import { isNewProduct } from "@/modules/products/domain/product-novelty";
import { ProductPageCoupons } from "@/modules/coupons/components/product-page-coupons";
import { toProductPageCouponView } from "@/modules/coupons/domain/product-page-coupon-view";
import { listProductPageCoupons } from "@/modules/coupons/queries/product-page-coupons";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";
import {
  getProductOfferSummary,
  getVariantStock,
  isVariantOnSale,
} from "@/modules/products/domain/product-offer-summary";
import { buildProductInteractionHref } from "@/modules/products/domain/product-interaction-href";
import { formatUnitsSold } from "@/modules/products/domain/units-sold";
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
      siteName: BRAND_SITE_NAME,
      title: product.name,
      description: product.description.slice(0, 160),
      url: `/products/${product.slug}`,
      ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
    },
  };
}

type ProductSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: ProductSearchParams;
}) {
  const { slug } = await params;
  // Checa a existência antes de qualquer Suspense: depois que o streaming começa, o status já saiu como 200.
  // A consulta é a mesma (em cache) usada pelo generateMetadata.
  if (!(await getApprovedProductSeoBySlug(slug))) notFound();

  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductDetail slug={slug} searchParams={searchParams} />
    </Suspense>
  );
}

async function ProductDetail({ slug, searchParams }: { slug: string; searchParams: ProductSearchParams }) {
  const [loadedInteractionParams, rawSearchParams] = await Promise.all([
    loadProductInteractionSearchParams(searchParams),
    searchParams,
  ]);
  const [product, session, fitments] = await Promise.all([
    getApprovedProductBySlug(slug, loadedInteractionParams),
    getCurrentSession(),
    listActiveMotorcycleFitments(),
  ]);
  if (!product) notFound();

  const [coupons, universal, [isFavorite, primaryMotorcycle]] = await Promise.all([
    listProductPageCoupons(product.id),
    isUniversalCategory(product.categoryId),
    session
      ? Promise.all([isProductFavorited(session.user.id, product.id), getPrimarySavedMotorcycle(session.user.id)])
      : Promise.resolve([false, null] as const),
  ]);

  const productPath = `/products/${product.slug}`;
  // Moto escolhida na página (?moto=, apenas ids da base ativa) tem prioridade sobre a principal salva.
  const urlFitment = fitments.find((fitment) => fitment.id === rawSearchParams.moto);
  const selectedFitment =
    urlFitment ?? fitments.find((fitment) => fitment.id === primaryMotorcycle?.motorcycleFitmentId);
  const interactionParams = { ...loadedInteractionParams, moto: urlFitment?.id ?? null };
  const unitsSoldLabel = formatUnitsSold(product.unitsSold);
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
  const fitmentStatus = resolveFitmentStatus({
    universal,
    compatibleFitmentIds: product.compatibilities.map((compatibility) => compatibility.motorcycleFitmentId),
    selectedFitment: selectedFitment ? { id: selectedFitment.id, label: formatFitmentLabel(selectedFitment) } : null,
  });
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
  const motorcyclePicker = (
    <ProductMotorcyclePicker
      key={selectedFitment?.id ?? "none"}
      fitments={fitments.map((fitment) => ({
        id: fitment.id,
        manufacturer: fitment.motorcycleModel.manufacturer.name,
        model: fitment.motorcycleModel.name,
        version: fitment.version,
        displacementCc: fitment.displacementCc,
        year: fitment.year,
      }))}
      selectedFitmentId={selectedFitment?.id ?? null}
      savedFitmentId={primaryMotorcycle?.motorcycleFitmentId ?? null}
      signedIn={Boolean(session)}
      productHref={buildProductInteractionHref(product.slug, interactionParams)}
    />
  );

  return (
    <main className={pageContainerClassName("default", "flex flex-col gap-8 pt-8 pb-28 sm:pt-12 md:pb-12")}>
      {!product.isDemo ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      ) : null}
      <ProductBreadcrumb category={{ slug: product.category.slug, label: categoryLabel }} productName={product.name} />

      {/*
        Mobile: galeria → compra → descrição. Desktop: galeria e "Sobre este produto" na coluna
        esquerda, área de compra na direita; a linha 1fr absorve a altura extra da área de compra.
      */}
      <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:items-start lg:gap-x-8">
        <div className="min-w-0 md:col-start-1 md:row-start-1">
          <ProductGallery images={galleryImages} productName={product.name} />
        </div>

        <section
          className="border-border bg-card min-w-0 rounded-3xl border p-5 shadow-[0_16px_50px_-36px_rgba(0,0,0,0.4)] sm:p-7 md:col-start-2 md:row-span-2 md:row-start-1"
          aria-labelledby="product-title"
        >
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{categoryLabel}</Badge>
            <Badge variant="neutral">{product.brand.name}</Badge>
            {offer.hasPromotion ? <Badge>Oferta</Badge> : null}
            {product.seller.subscriptions.length > 0 ? <Badge variant="brand">Patrocinado · Loja VIP</Badge> : null}
            {/* oxlint-disable-next-line react/purity -- Server Component: it renders once per request, on the server, so the date cannot drift between renders. */}
            {isNewProduct(product, new Date()) ? <Badge variant="inverse">Novidade</Badge> : null}
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
          {productRating || sellerRating || unitsSoldLabel ? (
            <p className="text-muted-foreground mt-2 flex flex-wrap gap-x-2 text-xs">
              {productRating ? (
                <a href="#avaliacoes" className="hover:text-foreground underline-offset-4 hover:underline">
                  Produto {formatRating(productRating)}/5 ({product.productReviewCount})
                </a>
              ) : null}
              {sellerRating ? <span>Loja {formatRating(sellerRating)}/5</span> : null}
              {unitsSoldLabel ? <span className="text-foreground font-semibold">{unitsSoldLabel}</span> : null}
            </p>
          ) : null}

          <div className="border-border mt-6 border-t">
            <ProductBuyBox
              variants={buyBoxVariants}
              hasPriceRange={offer.hasPriceRange}
              fitment={<ProductFitmentBanner status={fitmentStatus} picker={motorcyclePicker} />}
            />
          </div>
          <ProductPageCoupons coupons={coupons.map(toProductPageCouponView)} />
          <ProductShippingQuote
            options={buyBoxVariants.map((variant) => ({
              id: variant.id,
              title: variant.title,
              available: variant.stock > 0,
            }))}
          />
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

        <Card className="min-w-0 md:col-start-1 md:row-start-2">
          <CardHeader>
            <CardTitle>Sobre este produto</CardTitle>
            <CardDescription>Detalhes fornecidos pela loja.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="leading-7 whitespace-pre-line">{product.description}</p>
          </CardContent>
        </Card>
      </div>

      <ProductCompatibilityCard
        compatibilities={product.compatibilities}
        selectedFitmentId={selectedFitment?.id ?? null}
        universal={universal}
      />

      <ProductReviewsSection
        slug={product.slug}
        params={interactionParams}
        reviews={product.productReviews}
        average={productRating}
        reviewCount={product.productReviewCount}
        distribution={product.reviewDistribution}
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
    </main>
  );
}
