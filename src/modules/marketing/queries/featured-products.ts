import "server-only";

import type { ProductCardData } from "@/components/storefront/product-card";
import { toProductCardData } from "@/modules/products/components/product-grid";
import { listApprovedProducts } from "@/modules/products/queries/products";

/** Até doze produtos aprovados e com estoque (três fileiras no desktop), já no formato do card público. */
export async function listFeaturedProducts(): Promise<ProductCardData[]> {
  const result = await listApprovedProducts({ pageSize: 12, availability: "IN_STOCK" });
  const now = new Date();
  return result.products.map((product) => toProductCardData(product, now));
}
