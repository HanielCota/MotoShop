import "server-only";

import { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";

function editableProductWhere(sellerId: string, productId: string) {
  return { id: productId, sellerId, status: { in: [ProductStatus.DRAFT, ProductStatus.REJECTED] } };
}

/**
 * Light check for the edit page, run before it starts streaming so a missing product answers 404.
 * Same rule as the page: an editable product of this store with at least one active variant.
 */
export async function isSellerProductEditable(sellerId: string, productId: string) {
  const product = await db.product.findFirst({
    where: { ...editableProductWhere(sellerId, productId), variants: { some: { active: true } } },
    select: { id: true },
  });
  return product != null;
}

/** Produto editável (rascunho ou rejeitado) da loja, com imagens, variações ativas e compatibilidades. */
export async function getSellerProductForEdit(sellerId: string, productId: string) {
  return db.product.findFirst({
    where: editableProductWhere(sellerId, productId),
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { active: true }, include: { inventory: true }, orderBy: { createdAt: "asc" } },
      compatibilities: { select: { motorcycleFitmentId: true } },
    },
  });
}
