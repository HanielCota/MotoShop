import type { Route } from "next";
import { PackageSearch } from "lucide-react";
import type { ReactNode } from "react";

import {
  EAGER_PRODUCT_CARDS,
  PRODUCT_CARD_IMAGE_WIDTH,
  ProductCard,
  type ProductCardData,
} from "@/components/storefront/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { getProductOffer } from "@/modules/products/domain/product-offer";
import { isNewProduct } from "@/modules/products/domain/product-novelty";
import { getCurrentPriceInCents, hasActivePromotion } from "@/modules/products/domain/pricing";
import { getPublicStorageImageUrl } from "@/shared/storage/public-storage-url";
import type { listApprovedProducts } from "@/modules/products/queries/products";

type ApprovedProduct = Awaited<ReturnType<typeof listApprovedProducts>>["products"][number];

type CardSourceVariant = Parameters<typeof getProductOffer>[0][number] &
  Parameters<typeof hasActivePromotion>[0] & { priceInCents: number };

type CardSourceProduct = {
  id: string;
  slug: string;
  name: string;
  isDemo: boolean;
  isVip?: boolean;
  reviewedAt: Date | null;
  createdAt: Date;
  category: Parameters<typeof getCategoryLabel>[0] & { slug: string };
  brand: { name: string; slug: string };
  seller: { store: { name: string; slug: string } | null };
  images: { storageKey: string; altText: string | null }[];
  variants: CardSourceVariant[];
};

/** Converte um produto aprovado no modelo de apresentação do card, sempre no servidor. */
export function toProductCardData(product: CardSourceProduct, now = new Date()): ProductCardData {
  const offer = getProductOffer(product.variants, now);
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
    availableQuantity: offer.availableQuantity,
    isDemo: product.isDemo,
    sponsored: Boolean(product.isVip),
    isNew: isNewProduct(product, now),
  };
}

export function ProductGrid({
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
        <EmptyState icon={PackageSearch} title={emptyTitle} description={emptyMessage} action={emptyAction} />
      </div>
    );
  }

  const now = new Date();
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {products.map((product, index) => (
        <li key={product.id} className="flex min-w-0">
          <ProductCard product={toProductCardData(product, now)} eager={index < EAGER_PRODUCT_CARDS} />
        </li>
      ))}
    </ul>
  );
}
