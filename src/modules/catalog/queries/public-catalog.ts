import "server-only";

import { db } from "@/lib/database";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

export async function getPublicCategoryBySlug(slug: string) {
  return db.category.findFirst({
    where: { slug, active: true },
    select: { id: true, name: true, slug: true, parent: { select: { name: true, slug: true } } },
  });
}

export async function getPublicBrandBySlug(slug: string) {
  return db.brand.findFirst({ where: { slug, active: true }, select: { id: true, name: true, slug: true } });
}

export async function getPublicStoreBySlug(
  slug: string,
  input: { reviewPage?: number; reviewSort?: "newest" | "oldest" } = {},
) {
  const store = await db.store.findFirst({
    where: { slug, seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoStorageKey: true,
      bannerStorageKey: true,
      instagramUrl: true,
      youtubeUrl: true,
      whatsappUrl: true,
      facebookUrl: true,
      sellerId: true,
      updatedAt: true,
      seller: {
        select: {
          subscriptions: {
            where: { status: "ACTIVE", startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!store) return null;
  const pageSize = 6;
  const requestedPage = Math.max(input.reviewPage ?? 1, 1);
  const [reviewSummary, reviewCount, reviews] = await Promise.all([
    db.sellerReview.aggregate({
      where: { sellerId: store.sellerId, hiddenAt: null },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    db.sellerReview.count({ where: { sellerId: store.sellerId, hiddenAt: null } }),
    db.sellerReview.findMany({
      where: { sellerId: store.sellerId, hiddenAt: null },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: input.reviewSort === "oldest" ? "asc" : "desc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    ...store,
    logoUrl: store.logoStorageKey ? getPublicStorageUrl(store.logoStorageKey) : null,
    bannerUrl: store.bannerStorageKey ? getPublicStorageUrl(store.bannerStorageKey) : null,
    reviewSummary: { average: reviewSummary._avg.rating, count: reviewSummary._count._all },
    reviewPage: Math.min(requestedPage, Math.max(Math.ceil(reviewCount / pageSize), 1)),
    reviewPageCount: Math.max(Math.ceil(reviewCount / pageSize), 1),
    seller: { ...store.seller, sellerReviews: reviews },
  };
}

export async function getPublicMotorcycleByYear(manufacturerSlug: string, modelSlug: string, year: number) {
  return db.motorcycleModel.findFirst({
    where: {
      slug: modelSlug,
      active: true,
      manufacturer: { slug: manufacturerSlug, active: true },
    },
    select: {
      name: true,
      slug: true,
      manufacturer: { select: { name: true, slug: true } },
      fitments: {
        where: { year },
        select: { id: true, version: true, displacementCc: true, year: true },
        orderBy: [{ version: "asc" }, { displacementCc: "asc" }],
      },
    },
  });
}
