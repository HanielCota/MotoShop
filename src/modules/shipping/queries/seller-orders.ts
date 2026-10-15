import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { SellerOrderStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { parseDateFilter } from "@/lib/date-filter";

import {
  getSellerOrderQueueStatuses,
  resolveSellerOrderQueue,
  type SellerOrderQueue,
} from "../domain/seller-order-queue";
import type { sellerOrderSortValues, sellerOrderStatusValues, shipmentStatusValues } from "../search-params";

type SellerOrderFilterStatus = (typeof sellerOrderStatusValues)[number];
type ShipmentFilterStatus = (typeof shipmentStatusValues)[number];
type SellerOrderSort = (typeof sellerOrderSortValues)[number];

type SellerOrderListInput = {
  /** Sem fila, lista todos os pedidos; a página abre em "A preparar" pelo search param. */
  queue?: SellerOrderQueue;
  q?: string | null;
  from?: string | null;
  to?: string | null;
  sort: SellerOrderSort;
  status: SellerOrderFilterStatus;
  shipmentStatus: ShipmentFilterStatus;
  page: number;
};

const pageSize = 20;

export async function listSellerOrders(sellerId: string, input: SellerOrderListInput) {
  const page = Math.max(input.page, 1);
  const where = buildSellerOrderWhere(sellerId, input);
  const [total, orders] = await Promise.all([
    db.sellerOrder.count({ where }),
    db.sellerOrder.findMany({
      where,
      include: {
        order: { include: { shippingAddress: true } },
        shipment: true,
        items: true,
        cancellationRequests: {
          where: { status: { in: ["REQUESTED", "APPROVED"] } },
          select: { id: true, customerMessage: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: input.sort === "oldest" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { orders, total, page: Math.min(page, pageCount), pageCount };
}

/** O `sellerId` é sempre o primeiro filtro: os demais apenas restringem pedidos da própria loja. */
function buildSellerOrderWhere(sellerId: string, input: SellerOrderListInput) {
  const query = input.q?.trim();
  const queueStatuses = getSellerOrderQueueStatuses(resolveSellerOrderQueue(input.queue ?? "ALL", input.status));
  return {
    sellerId,
    ...buildCreatedAtFilter(input.from, input.to),
    ...(input.status !== "ALL" ? { status: input.status } : {}),
    ...(queueStatuses ? { status: { in: [...queueStatuses] } } : {}),
    ...(input.shipmentStatus !== "ALL" ? { shipment: { status: input.shipmentStatus } } : {}),
    ...(query ? { OR: buildSellerOrderSearch(query) } : {}),
  } satisfies Prisma.SellerOrderWhereInput;
}

function buildCreatedAtFilter(fromValue: string | null | undefined, toValue: string | null | undefined) {
  const from = parseDateFilter(fromValue, false);
  const to = parseDateFilter(toValue, true);
  if (!from && !to) return {};
  return { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } };
}

function buildSellerOrderSearch(query: string) {
  const contains = { contains: query, mode: "insensitive" as const };
  return [
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

/** Contagem por status para as abas da fila; sempre restrita ao `sellerId`. */
export async function countSellerOrdersByStatus(sellerId: string) {
  const groups = await db.sellerOrder.groupBy({ by: ["status"], where: { sellerId }, _count: { _all: true } });
  return Object.fromEntries(groups.map((group) => [group.status, group._count._all])) as Partial<
    Record<SellerOrderStatus, number>
  >;
}
