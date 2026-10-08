import "server-only";

import type { ProductCardData } from "@/components/storefront/product-card";
import { toProductCardData } from "@/modules/products/components/product-grid";
import { listApprovedProducts } from "@/modules/products/queries/products";

/** Até quatro produtos aprovados e com estoque, já no formato do card público. */
export async function listFeaturedProducts(): Promise<ProductCardData[]> {
  const result = await listApprovedProducts({ pageSize: 4, availability: "IN_STOCK" });
  const now = new Date();
  return result.products.map((product) => toProductCardData(product, now));
}
