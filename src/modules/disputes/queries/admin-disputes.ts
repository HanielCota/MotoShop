import "server-only";

import { DisputeStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";

import { parseDateBoundary } from "@/modules/admin/queries/date-boundary";

export async function listDisputesForAdmin(
  input: {
    status?: string;
    q?: string | null;
    sellerId?: string | null;
    from?: string | null;
    to?: string | null;
    sort?: "oldest" | "newest";
    page?: number;
  } = {},
) {
  const pageSize = 20;
  const requestedPage = Math.max(input.page ?? 1, 1);
  const status = input.status && input.status !== "ALL" ? (input.status as DisputeStatus) : undefined;
  const where: Prisma.DisputeWhereInput = status
    ? { status }
    : { status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] } };
  const query = input.q?.trim();
  const from = parseDateBoundary(input.from, false);
  const to = parseDateBoundary(input.to, true);
  if (input.sellerId) where.sellerId = input.sellerId;
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
  if (query) {
    where.OR = [
      { order: { orderNumber: { contains: query, mode: "insensitive" } } },
      { order: { customerName: { contains: query, mode: "insensitive" } } },
      { order: { customerEmail: { contains: query, mode: "insensitive" } } },
      { seller: { store: { name: { contains: query, mode: "insensitive" } } } },
      {
        sellerOrder: {
          items: {
            some: {
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
  const [total, disputes] = await Promise.all([
    db.dispute.count({ where }),
    db.dispute.findMany({
      where,
      include: {
        order: { select: { orderNumber: true, customerName: true, customerEmail: true } },
        seller: { include: { store: true } },
        sellerOrder: { include: { items: true } },
        requester: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: input.sort === "newest" ? "desc" : "asc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { disputes, total, page: Math.min(requestedPage, pageCount), pageCount };
}
