import type { Route } from "next";
import type { ReactNode } from "react";

import {
  EAGER_PRODUCT_CARDS,
  PRODUCT_CARD_IMAGE_WIDTH,
  ProductCard,
  type ProductCardData,
} from "@/components/storefront/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getMarketplaceLimits } from "@/modules/admin/application/marketplace-limits";
import type { MarketplaceLimits } from "@/modules/admin/domain/marketplace-limits";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { getProductOffer } from "@/modules/products/domain/product-offer";
import { isNewProduct } from "@/modules/products/domain/product-novelty";
import { getPublicStockStatus } from "@/modules/products/domain/stock-status";
import { getCurrentPriceInCents, hasActivePromotion } from "@/modules/products/domain/pricing";
import { getPublicStorageImageUrl } from "@/shared/storage/public-storage-url";
import type { listApprovedProducts } from "@/modules/products/queries/products";
import { domainIcons } from "@/shared/presentation/domain-icons";

type ApprovedProduct = Awaited<ReturnType<typeof listApprovedProducts>>["products"][number];

type CardSourceVariant = Parameters<typeof getProductOffer>[0][number] &
  Parameters<typeof hasActivePromotion>[0] & { priceInCents: number };

type CardSourceProduct = {
  id: string;
  slug: string;
  name: string;
  isVip?: boolean;
  reviewedAt: Date | null;
  createdAt: Date;
  category: Parameters<typeof getCategoryLabel>[0] & { slug: string };
  brand: { name: string; slug: string };
  seller: { store: { name: string; slug: string } | null };
  images: { storageKey: string; altText: string | null }[];
  variants: CardSourceVariant[];
};

/** Limits that decide the card badges: "Últimas unidades" and "Novidade". */
export type ProductCardRules = Pick<MarketplaceLimits, "lastUnitsThreshold" | "newProductDays">;

/** Card fields that do not depend on the Admin limits: names, links, image and price. */
export type ProductCardSummary = Omit<ProductCardData, "stockStatus" | "isNew">;

/**
 * Turns an approved product into the card model, always on the server.
 *
 * @param rules - Badge limits from Admin › Configurações › Limites.
 */
export function toProductCardData(
  product: CardSourceProduct,
  rules: ProductCardRules,
  now = new Date(),
): ProductCardData {
  const offer = getProductOffer(product.variants, now);
  return {
    ...buildProductCardSummary(product, offer, now),
    stockStatus: getPublicStockStatus(offer.availableQuantity, rules.lastUnitsThreshold),
    isNew: isNewProduct(product, now, rules.newProductDays),
  };
}

/** The card fields without the badges, for lists that show neither stock nor "Novidade" (search suggestions). */
export function toProductCardSummary(product: CardSourceProduct, now = new Date()): ProductCardSummary {
  return buildProductCardSummary(product, getProductOffer(product.variants, now), now);
}

function buildProductCardSummary(
  product: CardSourceProduct,
  offer: ReturnType<typeof getProductOffer>,
  now: Date,
): ProductCardSummary {
  const cheapest = product.variants
    .filter((variant) => variant.active !== false)
    .find((variant) => getCurrentPriceInCents(variant, now) === offer.priceInCents);
  const compareAt =
    cheapest && hasActivePromotion(cheapest, now) && cheapest.priceInCents > (offer.priceInCents ?? 0)
      ? cheapest.priceInCents
      : null;
  const image = product.images[0];
  return {
    id: product.id,
    name: product.name,
    href: `/products/${product.slug}`,
    imageUrl: image ? getPublicStorageImageUrl(image.storageKey, PRODUCT_CARD_IMAGE_WIDTH) : null,
    imageAlt: image?.altText ?? product.name,
    category: { label: getCategoryLabel(product.category), href: `/categoria/${product.category.slug}` as Route },
    brand: { name: product.brand.name, href: `/marca/${product.brand.slug}` as Route },
    seller: product.seller.store
      ? { name: product.seller.store.name, href: `/loja/${product.seller.store.slug}` as Route }
      : undefined,
    priceInCents: offer.priceInCents,
    compareAtPriceInCents: compareAt,
    hasPriceRange: offer.hasPriceRange,
    sponsored: Boolean(product.isVip),
  };
}

export async function ProductGrid({
  products,
  emptyMessage = "Nenhum produto aprovado corresponde aos filtros.",
  emptyTitle = "Nenhum produto encontrado",
  emptyAction,
}: {
  products: ApprovedProduct[];
  emptyMessage?: string;
  emptyTitle?: string;
  emptyAction?: { label: string; href: Route } | ReactNode;
}) {
  if (products.length === 0) {
    return (
      <div role="status">
        <EmptyState icon={domainIcons.notFound} title={emptyTitle} description={emptyMessage} action={emptyAction} />
      </div>
    );
  }

  const rules = await getMarketplaceLimits();
  // oxlint-disable-next-line react/purity -- Server Component: it renders once per request, on the server, so the date cannot drift between renders.
  const now = new Date();
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {products.map((product, index) => (
        <li key={product.id} className="flex min-w-0">
          <ProductCard product={toProductCardData(product, rules, now)} eager={index < EAGER_PRODUCT_CARDS} />
        </li>
      ))}
    </ul>
  );
}
