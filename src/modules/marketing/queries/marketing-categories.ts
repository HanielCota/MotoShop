import "server-only";

import { db } from "@/lib/database";

export async function listMarketingCategories() {
  return db.category.findMany({
    where: { active: true },
    select: { id: true, name: true, slug: true, parentId: true },
    orderBy: { name: "asc" },
  });
}
