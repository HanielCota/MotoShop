import "server-only";

import { db } from "@/lib/database";

export async function listMarketingCategories() {
  return db.category.findMany({
    where: { active: true },
    select: { id: true, name: true, slug: true, parentId: true },
    // Same order as Admin › Catálogo: the display order the admin sets, then the name for ties.
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
