import "server-only";

import type { ProductCardData } from "@/components/storefront/product-card";
import { getMarketplaceLimits } from "@/modules/admin/application/marketplace-limits";
import { toProductCardData } from "@/modules/products/components/product-grid";
import { listApprovedProducts } from "@/modules/products/queries/products";

/** Até doze produtos aprovados e com estoque (três fileiras no desktop), já no formato do card público. */
export async function listFeaturedProducts(): Promise<ProductCardData[]> {
  const [result, rules] = await Promise.all([
    listApprovedProducts({ pageSize: 12, availability: "IN_STOCK" }),
    getMarketplaceLimits(),
  ]);
  const now = new Date();
  return result.products.map((product) => toProductCardData(product, rules, now));
}
