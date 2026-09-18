import "server-only";

import { db } from "@/lib/database";

export async function getAdminCatalogData() {
  const [categories, brands, manufacturers] = await Promise.all([
    db.category.findMany({
      include: { parent: true, _count: { select: { products: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.brand.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    }),
    db.motorcycleManufacturer.findMany({
      include: {
        models: {
          include: {
            fitments: { orderBy: [{ year: "desc" }, { version: "asc" }] },
            _count: { select: { fitments: true } },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return { categories, brands, manufacturers };
}

export async function listActiveMotorcycleFitmentsForProduct() {
  return db.motorcycleFitment.findMany({
    where: { motorcycleModel: { active: true, manufacturer: { active: true } } },
    include: { motorcycleModel: { include: { manufacturer: true } } },
    orderBy: [
      { motorcycleModel: { manufacturer: { name: "asc" } } },
      { motorcycleModel: { name: "asc" } },
      { year: "desc" },
    ],
  });
}
