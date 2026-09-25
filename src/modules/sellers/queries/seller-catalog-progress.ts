import "server-only";

import { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";

export type SellerCatalogProgress = {
  editable: number;
  submitted: number;
  approved: number;
};

export async function getSellerCatalogProgress(sellerId: string): Promise<SellerCatalogProgress> {
  const groups = await db.product.groupBy({
    by: ["status"],
    where: {
      sellerId,
      status: { in: [ProductStatus.DRAFT, ProductStatus.REJECTED, ProductStatus.SUBMITTED, ProductStatus.APPROVED] },
    },
    _count: { _all: true },
  });
  const counts = new Map(groups.map((group) => [group.status, group._count._all]));

  return {
    editable: (counts.get(ProductStatus.DRAFT) ?? 0) + (counts.get(ProductStatus.REJECTED) ?? 0),
    submitted: counts.get(ProductStatus.SUBMITTED) ?? 0,
    approved: counts.get(ProductStatus.APPROVED) ?? 0,
  };
}
