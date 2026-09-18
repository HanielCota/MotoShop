import "server-only";

import { SellerOrderStatus, ShipmentStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";

import { parseDateBoundary } from "./date-boundary";

export async function listSellerOrdersForAdmin(
  input: {
    status?: string;
    shipmentStatus?: string;
    q?: string | null;
    sellerId?: string | null;
    from?: string | null;
    to?: string | null;
    sort?: "newest" | "oldest";
    page?: number;
  } = {},
) {
  const pageSize = 20;
  const requestedPage = Math.max(input.page ?? 1, 1);
  const status = input.status && input.status !== "ALL" ? (input.status as SellerOrderStatus) : undefined;
  const shipmentStatus =
    input.shipmentStatus && input.shipmentStatus !== "ALL" ? (input.shipmentStatus as ShipmentStatus) : undefined;
  const query = input.q?.trim().slice(0, 100);
  const from = parseDateBoundary(input.from, false);
  const to = parseDateBoundary(input.to, true);
  const where = {
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(status ? { status } : {}),
    ...(shipmentStatus ? { shipment: { status: shipmentStatus } } : {}),
    ...(input.sellerId ? { sellerId: input.sellerId } : {}),
    ...(query
      ? {
          OR: [
            { storeNameSnapshot: { contains: query, mode: "insensitive" as const } },
            {
              order: {
                OR: [
                  { orderNumber: { contains: query, mode: "insensitive" as const } },
                  { customerName: { contains: query, mode: "insensitive" as const } },
                  { customerEmail: { contains: query, mode: "insensitive" as const } },
                ],
              },
            },
            { items: { some: { OR: [
              { productNameSnapshot: { contains: query, mode: "insensitive" as const } },
              { skuSnapshot: { contains: query, mode: "insensitive" as const } },
            ] } } },
          ],
        }
      : {}),
  };
  const [total, orders] = await Promise.all([
    db.sellerOrder.count({ where }),
    db.sellerOrder.findMany({
      where,
      select: {
        id: true,
        status: true,
        storeNameSnapshot: true,
        sellerId: true,
        createdAt: true,
        seller: { select: { store: { select: { slug: true } } } },
        order: { select: { orderNumber: true, customerName: true, customerEmail: true } },
        shipment: { select: { status: true, trackingCode: true, trackingUrl: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: input.sort === "oldest" ? "asc" : "desc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { orders, total, page: Math.min(requestedPage, pageCount), pageCount };
}
