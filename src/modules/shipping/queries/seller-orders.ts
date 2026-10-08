import "server-only";

import { db } from "@/lib/database";
import { parseDateFilter } from "@/lib/date-filter";

import type { sellerOrderSortValues, sellerOrderStatusValues, shipmentStatusValues } from "../search-params";

type SellerOrderFilterStatus = (typeof sellerOrderStatusValues)[number];
type ShipmentFilterStatus = (typeof shipmentStatusValues)[number];
type SellerOrderSort = (typeof sellerOrderSortValues)[number];

export async function listSellerOrders(
  sellerId: string,
  input: {
    q?: string | null;
    from?: string | null;
    to?: string | null;
    sort: SellerOrderSort;
    status: SellerOrderFilterStatus;
    shipmentStatus: ShipmentFilterStatus;
    page: number;
  },
) {
  const pageSize = 20;
  const page = Math.max(input.page, 1);
  const query = input.q?.trim();
  const from = parseDateFilter(input.from, false);
  const to = parseDateFilter(input.to, true);
  const where = {
    sellerId,
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(input.status !== "ALL" ? { status: input.status } : {}),
    ...(input.shipmentStatus !== "ALL" ? { shipment: { status: input.shipmentStatus } } : {}),
    ...(query
      ? {
          OR: [
            {
              order: {
                OR: [
                  { orderNumber: { contains: query, mode: "insensitive" as const } },
                  { customerName: { contains: query, mode: "insensitive" as const } },
                  { customerEmail: { contains: query, mode: "insensitive" as const } },
                ],
              },
            },
            {
              items: {
                some: {
                  OR: [
                    { productNameSnapshot: { contains: query, mode: "insensitive" as const } },
                    { skuSnapshot: { contains: query, mode: "insensitive" as const } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
  const [total, orders] = await Promise.all([
    db.sellerOrder.count({ where }),
    db.sellerOrder.findMany({
      where,
      include: {
        order: { include: { shippingAddress: true } },
        shipment: true,
        items: true,
      },
      orderBy: { createdAt: input.sort === "oldest" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { orders, total, page: Math.min(page, pageCount), pageCount };
}
