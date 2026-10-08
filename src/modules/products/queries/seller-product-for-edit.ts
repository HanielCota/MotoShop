import "server-only";

import { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";

/** Produto editável (rascunho ou rejeitado) da loja, com imagens, variações ativas e compatibilidades. */
export async function getSellerProductForEdit(sellerId: string, productId: string) {
  return db.product.findFirst({
    where: { id: productId, sellerId, status: { in: [ProductStatus.DRAFT, ProductStatus.REJECTED] } },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { active: true }, include: { inventory: true }, orderBy: { createdAt: "asc" } },
      compatibilities: { select: { motorcycleFitmentId: true } },
    },
  });
}
