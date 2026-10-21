import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";

export async function listSavedMotorcycles(userId: string) {
  return db.savedMotorcycle.findMany({
    where: { userId },
    select: {
      id: true,
      motorcycleFitmentId: true,
      isPrimary: true,
      motorcycleFitment: {
        select: {
          version: true,
          displacementCc: true,
          year: true,
          motorcycleModel: {
            select: { name: true, active: true, manufacturer: { select: { name: true, active: true } } },
          },
        },
      },
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
}

export async function getPrimarySavedMotorcycle(userId: string) {
  return db.savedMotorcycle.findFirst({
    where: {
      userId,
      isPrimary: true,
      motorcycleFitment: { motorcycleModel: { active: true, manufacturer: { active: true } } },
    },
    select: {
      motorcycleFitmentId: true,
      motorcycleFitment: {
        select: {
          version: true,
          displacementCc: true,
          year: true,
          motorcycleModel: { select: { name: true, manufacturer: { select: { name: true } } } },
        },
      },
    },
  });
}

/**
 * Public products shown for each fitment, with the catalog rules: approved products with an active
 * variant, of approved or active sellers, in active categories and brands, that are confirmed for the
 * fitment or belong to a universal category (or one below it). Fitments without any product are absent from the map.
 */
export async function countCompatibleProductsByFitment(fitmentIds: readonly string[]): Promise<Map<string, number>> {
  if (fitmentIds.length === 0) return new Map();

  // Same universal-category rule as the catalog motorcycle filter (public-product-page.ts).
  const rows = await db.$queryRaw<Array<{ fitmentId: string; total: bigint }>>(Prisma.sql`
    WITH RECURSIVE universal_categories AS (
      SELECT id FROM categories WHERE universal = true
      UNION
      SELECT child.id FROM categories child JOIN universal_categories parent ON child."parentId" = parent.id
    )
    SELECT f.id AS "fitmentId", count(p.id) AS total
    FROM unnest(ARRAY[${Prisma.join([...fitmentIds])}]::text[]) AS f(id)
    JOIN products p ON p.status = 'APPROVED'
    JOIN sellers s ON s.id = p."sellerId" AND s.status IN ('APPROVED', 'ACTIVE')
    JOIN categories c ON c.id = p."categoryId" AND c.active = true
    JOIN brands b ON b.id = p."brandId" AND b.active = true
    WHERE EXISTS (SELECT 1 FROM product_variants v WHERE v."productId" = p.id AND v.active = true)
      AND (
        p."categoryId" IN (SELECT id FROM universal_categories)
        OR EXISTS (
          SELECT 1 FROM product_compatibilities pc WHERE pc."productId" = p.id AND pc."motorcycleFitmentId" = f.id
        )
      )
    GROUP BY f.id`);

  return new Map(rows.map((row) => [row.fitmentId, Number(row.total)]));
}
