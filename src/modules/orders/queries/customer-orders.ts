import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { OrderStatus, PaymentStatus, ShipmentStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { parseDateFilter } from "@/lib/date-filter";

type CustomerOrderSort = "newest" | "oldest" | "total_high" | "total_low";

type CustomerOrderListInput = {
  status?: string;
  q?: string | null;
  storeQ?: string | null;
  shipmentStatus?: string;
  paymentStatus?: string;
  from?: string | null;
  to?: string | null;
  minTotalInCents?: number | null;
  maxTotalInCents?: number | null;
  orderSort?: CustomerOrderSort;
  page?: number;
  pageSize?: number;
};

const customerOrderOrderBy = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  total_high: { totalAmountInCents: "desc" },
  total_low: { totalAmountInCents: "asc" },
} satisfies Record<CustomerOrderSort, Prisma.OrderOrderByWithRelationInput>;

const customerOrderSelect = {
  orderNumber: true,
  status: true,
  totalAmountInCents: true,
  createdAt: true,
  payments: {
    select: { status: true, method: true },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
  sellerOrders: {
    select: {
      id: true,
      status: true,
      storeNameSnapshot: true,
      // Name and first photo let the customer recognize the purchase without the order number.
      items: {
        select: {
          id: true,
          productNameSnapshot: true,
          productId: true,
          variantId: true,
        },
        orderBy: { createdAt: "asc" },
      },
      shipment: { select: { status: true, trackingCode: true, trackingUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.OrderSelect;

export async function listCustomerOrders(userId: string, input: CustomerOrderListInput = {}) {
  const pageSize = Math.min(Math.max(input.pageSize ?? 10, 1), 30);
  const requestedPage = Math.max(input.page ?? 1, 1);
  const where = buildCustomerOrderWhere(userId, input);

  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      select: customerOrderSelect,
      orderBy: customerOrderOrderBy[input.orderSort ?? "newest"],
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { orders, total, page: Math.min(requestedPage, pageCount), pageCount };
}

/** O `userId` é sempre o primeiro filtro: os demais apenas restringem pedidos do próprio cliente. */
function buildCustomerOrderWhere(userId: string, input: CustomerOrderListInput) {
  const status = readFilterValue<OrderStatus>(input.status);
  const query = input.q?.trim().slice(0, 100);
  const paymentStatus = readFilterValue<PaymentStatus>(input.paymentStatus);

  return {
    userId,
    ...buildCreatedAtFilter(input.from, input.to),
    ...buildTotalAmountFilter(input.minTotalInCents, input.maxTotalInCents),
    ...(status ? { status } : {}),
    ...(query ? { OR: buildCustomerOrderSearch(query) } : {}),
    ...buildSellerOrderFilter(input),
    ...(paymentStatus ? { payments: { some: { status: paymentStatus } } } : {}),
  } satisfies Prisma.OrderWhereInput;
}

function readFilterValue<Value extends string>(value: string | undefined) {
  return value && value !== "ALL" ? (value as Value) : undefined;
}

function buildCreatedAtFilter(fromValue: string | null | undefined, toValue: string | null | undefined) {
  const from = parseDateFilter(fromValue, false);
  const to = parseDateFilter(toValue, true);
  if (!from && !to) return {};
  return { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } };
}

function buildTotalAmountFilter(minimumValue: number | null | undefined, maximumValue: number | null | undefined) {
  const minimumTotal = readNonNegativeInteger(minimumValue);
  const maximumTotal = readNonNegativeInteger(maximumValue);
  if (minimumTotal === undefined && maximumTotal === undefined) return {};
  return {
    totalAmountInCents: {
      ...(minimumTotal !== undefined ? { gte: minimumTotal } : {}),
      ...(maximumTotal !== undefined ? { lte: maximumTotal } : {}),
    },
  };
}

function readNonNegativeInteger(value: number | null | undefined) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function buildCustomerOrderSearch(query: string) {
  const contains = { contains: query, mode: "insensitive" as const };
  return [
    { orderNumber: contains },
    {
      sellerOrders: {
        some: {
          items: {
            some: {
              OR: [{ productNameSnapshot: contains }, { skuSnapshot: contains }],
            },
          },
        },
      },
    },
  ];
}

function buildSellerOrderFilter(input: CustomerOrderListInput) {
  const storeQuery = input.storeQ?.trim().slice(0, 100);
  const shipmentStatus = readFilterValue<ShipmentStatus>(input.shipmentStatus);
  if (!storeQuery && !shipmentStatus) return {};
  return {
    sellerOrders: {
      some: {
        ...(storeQuery ? { storeNameSnapshot: { contains: storeQuery, mode: "insensitive" as const } } : {}),
        ...(shipmentStatus ? { shipment: { status: shipmentStatus } } : {}),
      },
    },
  };
}
