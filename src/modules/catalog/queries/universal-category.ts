import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";

/**
 * True when the category, or any category above it, was marked universal by the Admin.
 * Same rule as the catalog motorcycle filter in public-product-page.ts, walked upwards in one query.
 */
export async function isUniversalCategory(categoryId: string): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ universal: boolean | null }>>(Prisma.sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, "parentId", universal FROM categories WHERE id = ${categoryId}
      UNION
      SELECT parent.id, parent."parentId", parent.universal
      FROM categories parent JOIN ancestors child ON parent.id = child."parentId"
    )
    SELECT bool_or(universal) AS universal FROM ancestors`);

  return rows[0]?.universal === true;
}
