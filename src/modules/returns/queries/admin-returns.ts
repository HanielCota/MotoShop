import "server-only";

import { Prisma, ReturnStatus } from "@/generated/prisma/client";
import { db } from "@/lib/database";

import { parseDateBoundary } from "@/modules/admin/queries/date-boundary";

type AdminReturnRequestFilters = {
  status?: string;
  q?: string | null;
  sellerId?: string | null;
  from?: string | null;
  to?: string | null;
  sort?: "oldest" | "newest";
  page?: number;
};

const pageSize = 20;

const openReturnStatuses = [
  ReturnStatus.REQUESTED,
  ReturnStatus.UNDER_REVIEW,
  ReturnStatus.APPROVED,
  ReturnStatus.RETURNED,
];

const adminReturnRequestInclude = {
  order: true,
  seller: { include: { store: true } },
  sellerOrder: { include: { shipment: true } },
  items: { include: { orderItem: true } },
} satisfies Prisma.ReturnRequestInclude;

export async function listReturnRequestsForAdmin(input: AdminReturnRequestFilters = {}) {
  const requestedPage = Math.max(input.page ?? 1, 1);
  const where = buildAdminReturnRequestWhere(input);
  const [total, requests] = await Promise.all([
    db.returnRequest.count({ where }),
    db.returnRequest.findMany({
      where,
      include: adminReturnRequestInclude,
      orderBy: { createdAt: input.sort === "newest" ? "desc" : "asc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { requests, total, page: Math.min(requestedPage, pageCount), pageCount };
}

function buildAdminReturnRequestWhere(input: AdminReturnRequestFilters): Prisma.ReturnRequestWhereInput {
  const status = input.status && input.status !== "ALL" ? (input.status as ReturnStatus) : undefined;
  const query = input.q?.trim();
  const createdAt = buildCreatedAtFilter(input.from, input.to);

  return {
    status: status ?? { in: openReturnStatuses },
    ...(input.sellerId ? { sellerId: input.sellerId } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(query ? { OR: buildReturnRequestSearch(query) } : {}),
  };
}

function buildCreatedAtFilter(
  fromInput: string | null | undefined,
  toInput: string | null | undefined,
): Prisma.DateTimeFilter | undefined {
  const from = parseDateBoundary(fromInput, false);
  const to = parseDateBoundary(toInput, true);
  if (!from && !to) return undefined;

  return { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
}

function buildReturnRequestSearch(query: string): Prisma.ReturnRequestWhereInput[] {
  return [
    { order: { orderNumber: { contains: query, mode: "insensitive" } } },
    { seller: { store: { name: { contains: query, mode: "insensitive" } } } },
    { customerMessage: { contains: query, mode: "insensitive" } },
    {
      items: {
        some: {
          orderItem: {
            OR: [
              { productNameSnapshot: { contains: query, mode: "insensitive" } },
              { skuSnapshot: { contains: query, mode: "insensitive" } },
            ],
          },
        },
      },
    },
  ];
}
