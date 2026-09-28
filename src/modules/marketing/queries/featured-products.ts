import "server-only";

import { formatMoneyInCents } from "@/lib/utils";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { getProductOffer } from "@/modules/products/domain/product-offer";
import { listApprovedProducts } from "@/modules/products/queries/products";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

export async function listFeaturedProducts() {
  const result = await listApprovedProducts({ pageSize: 4, availability: "IN_STOCK" });
  return result.products.map((product) => {
    const offer = getProductOffer(product.variants);
    return {
      id: product.id,
      name: product.name,
      category: getCategoryLabel(product.category),
      sellerName: product.seller.store?.name ?? "Loja especializada",
      price: offer.priceInCents === null ? "Sob consulta" : formatMoneyInCents(offer.priceInCents),
      hasPriceRange: offer.hasPriceRange,
      href: `/products/${product.slug}` as const,
      image: product.images[0] ? getPublicStorageUrl(product.images[0].storageKey) : null,
      imageAlt: product.images[0]?.altText ?? product.name,
      sponsored: product.isVip,
      isDemo: product.isDemo,
    };
  });
}
