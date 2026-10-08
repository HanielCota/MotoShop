import { ProductStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Single definition of "a variant a customer may buy right now": active
 * variant of an approved, non-demo product whose seller, category and brand
 * are all enabled. Shared by the cart and shipping quotes so they cannot drift.
 * `requireStock` additionally demands available inventory.
 */
export function purchasableVariantWhere(
  variantId: string,
  options: { requireStock?: boolean } = {},
): Prisma.ProductVariantWhereInput {
  return {
    id: variantId,
    active: true,
    ...(options.requireStock ? { inventory: { availableQuantity: { gt: 0 } } } : {}),
    product: {
      status: ProductStatus.APPROVED,
      isDemo: false,
      seller: { status: { in: ["APPROVED", "ACTIVE"] } },
      category: { active: true },
      brand: { active: true },
    },
  };
}
