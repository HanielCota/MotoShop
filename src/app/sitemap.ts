import type { MetadataRoute } from "next";

import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { db } from "@/lib/database";
import { ProductStatus } from "@/generated/prisma/enums";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getApplicationBaseUrl();
  const [products, categories, brands, stores, fitments] = await Promise.all([
    db.product.findMany({
      where: { status: ProductStatus.APPROVED, isDemo: false },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.category.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
    db.brand.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
    db.store.findMany({
      where: { seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
      select: { slug: true, updatedAt: true },
    }),
    db.motorcycleFitment.findMany({
      select: {
        year: true,
        updatedAt: true,
        motorcycleModel: {
          select: { slug: true, manufacturer: { select: { slug: true, active: true } }, active: true },
        },
      },
    }),
  ]);

  const motorcycleUrls = new Map<string, Date>();
  for (const fitment of fitments) {
    if (!fitment.motorcycleModel.active || !fitment.motorcycleModel.manufacturer.active) continue;
    const path = `/moto/${fitment.motorcycleModel.manufacturer.slug}/${fitment.motorcycleModel.slug}/${fitment.year}`;
    const current = motorcycleUrls.get(path);
    if (!current || fitment.updatedAt > current) motorcycleUrls.set(path, fitment.updatedAt);
  }

  return [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/products`, changeFrequency: "daily", priority: 0.9 },
    ...products.map((product) => ({
      url: `${baseUrl}/products/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...categories.map((category) => ({
      url: `${baseUrl}/categoria/${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...brands.map((brand) => ({
      url: `${baseUrl}/marca/${brand.slug}`,
      lastModified: brand.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...stores.map((store) => ({
      url: `${baseUrl}/loja/${store.slug}`,
      lastModified: store.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...[...motorcycleUrls.entries()].map(([path, lastModified]) => ({
      url: `${baseUrl}${path}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
