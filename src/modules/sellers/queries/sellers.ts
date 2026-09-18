import "server-only";

import { SellerStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";

export async function listSellersForAdmin(
  input: { status?: string; q?: string | null; sort?: "newest" | "oldest"; page?: number } = {},
) {
  const now = new Date();
  const pageSize = 20;
  const requestedPage = Math.max(input.page ?? 1, 1);
  const status = input.status && input.status !== "ALL" ? (input.status as SellerStatus) : undefined;
  const query = input.q?.trim().slice(0, 100);
  const where = {
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { store: { name: { contains: query, mode: "insensitive" as const } } },
            { members: { some: { user: { name: { contains: query, mode: "insensitive" as const } } } } },
            { members: { some: { user: { email: { contains: query, mode: "insensitive" as const } } } } },
          ],
        }
      : {}),
  };
  const [total, sellers] = await Promise.all([
    db.seller.count({ where }),
    db.seller.findMany({
      where,
      include: {
        store: true,
        members: { include: { user: true } },
        subscriptions: {
          where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } },
          orderBy: { endsAt: "desc" },
        },
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: input.sort === "oldest" ? "asc" : "desc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { sellers, total, page: Math.min(requestedPage, pageCount), pageCount };
}

export async function listSellerOptionsForAdmin() {
  return db.seller.findMany({
    where: { status: { in: ["APPROVED", "ACTIVE", "SUSPENDED"] } },
    select: { id: true, store: { select: { name: true } } },
    orderBy: { store: { name: "asc" } },
  });
}

export async function listPublicSellerOptions() {
  return db.seller.findMany({
    where: { status: { in: ["APPROVED", "ACTIVE"] }, store: { isNot: null } },
    select: { id: true, store: { select: { name: true, slug: true } } },
    orderBy: { store: { name: "asc" } },
  });
}

export async function getUserSellerMemberships(userId: string) {
  const now = new Date();
  return db.sellerMember.findMany({
    include: {
      seller: {
        include: {
          store: true,
          members: { include: { user: true }, orderBy: { createdAt: "asc" } },
          subscriptions: {
            where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } },
            orderBy: { endsAt: "desc" },
          },
        },
      },
    },
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}
