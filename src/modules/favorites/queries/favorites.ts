import "server-only";

import { Prisma, ProductStatus, SellerStatus } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import type { FavoriteAvailability, FavoriteSort } from "../search-params";

export async function isProductFavorited(userId: string, productId: string) {
  const favorite = await db.favorite.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  });
  return Boolean(favorite);
}

export async function listFavoriteProducts(
  userId: string,
  input: {
    query?: string | null;
    availability?: FavoriteAvailability;
    sort?: FavoriteSort;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const pageSize = Math.min(Math.max(input.pageSize ?? 12, 1), 48);
  const requestedPage = Math.max(input.page ?? 1, 1);
  const query = input.query?.trim().slice(0, 100);
  const productWhere: Prisma.ProductWhereInput = {
    status: ProductStatus.APPROVED,
    seller: { status: { in: [SellerStatus.APPROVED, SellerStatus.ACTIVE] } },
    ...(input.availability === "IN_STOCK"
      ? { variants: { some: { active: true, inventory: { availableQuantity: { gt: 0 } } } } }
      : input.availability === "OUT_OF_STOCK"
        ? { variants: { none: { active: true, inventory: { availableQuantity: { gt: 0 } } } } }
        : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { slug: { contains: query, mode: "insensitive" as const } },
            { brand: { name: { contains: query, mode: "insensitive" as const } } },
            { category: { name: { contains: query, mode: "insensitive" as const } } },
            { seller: { store: { name: { contains: query, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };
  const where: Prisma.FavoriteWhereInput = {
    userId,
    product: productWhere,
  };
  const [total, favorites] = await Promise.all([
    db.favorite.count({ where }),
    db.favorite.findMany({
      where,
      include: {
        product: {
          include: {
            seller: { include: { store: true } },
            category: true,
            brand: true,
            images: { orderBy: { sortOrder: "asc" }, take: 1 },
            variants: { where: { active: true }, include: { inventory: true }, orderBy: { createdAt: "asc" } },
          },
        },
      },
      orderBy: { createdAt: input.sort === "oldest" ? "asc" : "desc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { favorites, total, page: Math.min(requestedPage, pageCount), pageCount };
}
