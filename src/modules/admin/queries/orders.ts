import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { SellerOrderStatus, ShipmentStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";

import { buildCreatedAtBoundaryFilter } from "./date-boundary";

type AdminSellerOrderListInput = {
  status?: string;
  shipmentStatus?: string;
  q?: string | null;
  sellerId?: string | null;
  from?: string | null;
  to?: string | null;
  sort?: "newest" | "oldest";
  page?: number;
};

const pageSize = 20;

const adminSellerOrderSelect = {
  id: true,
  status: true,
  storeNameSnapshot: true,
  sellerId: true,
  createdAt: true,
  seller: { select: { store: { select: { slug: true } } } },
  order: { select: { orderNumber: true, customerName: true, customerEmail: true } },
  shipment: { select: { status: true, trackingCode: true, trackingUrl: true } },
  _count: { select: { items: true } },
} satisfies Prisma.SellerOrderSelect;

export async function listSellerOrdersForAdmin(input: AdminSellerOrderListInput = {}) {
  const requestedPage = Math.max(input.page ?? 1, 1);
  const where = buildAdminSellerOrderWhere(input);

  const [total, orders] = await Promise.all([
    db.sellerOrder.count({ where }),
    db.sellerOrder.findMany({
      where,
      select: adminSellerOrderSelect,
      orderBy: { createdAt: input.sort === "oldest" ? "asc" : "desc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { orders, total, page: Math.min(requestedPage, pageCount), pageCount };
}

/** A unidade operacional continua sendo o `SellerOrder`, mesmo quando a busca usa dados do `Order` global. */
function buildAdminSellerOrderWhere(input: AdminSellerOrderListInput) {
  const status = input.status && input.status !== "ALL" ? (input.status as SellerOrderStatus) : undefined;
  const shipmentStatus =
    input.shipmentStatus && input.shipmentStatus !== "ALL" ? (input.shipmentStatus as ShipmentStatus) : undefined;
  const query = input.q?.trim().slice(0, 100);

  return {
    ...buildCreatedAtBoundaryFilter(input.from, input.to),
    ...(status ? { status } : {}),
    ...(shipmentStatus ? { shipment: { status: shipmentStatus } } : {}),
    ...(input.sellerId ? { sellerId: input.sellerId } : {}),
    ...(query ? { OR: buildAdminSellerOrderSearch(query) } : {}),
  } satisfies Prisma.SellerOrderWhereInput;
}

function buildAdminSellerOrderSearch(query: string) {
  const contains = { contains: query, mode: "insensitive" as const };
  return [
    { storeNameSnapshot: contains },
    {
      order: {
        OR: [{ orderNumber: contains }, { customerName: contains }, { customerEmail: contains }],
      },
    },
    {
      items: {
        some: {
          OR: [{ productNameSnapshot: contains }, { skuSnapshot: contains }],
        },
      },
    },
  ];
}
