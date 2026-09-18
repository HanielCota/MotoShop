import "server-only";

import { OrderStatus, PaymentStatus, ShipmentStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";

function parseOrderDate(value: string | null | undefined, endOfDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export async function listCustomerOrders(
  userId: string,
  input: {
    status?: string;
    q?: string | null;
    storeQ?: string | null;
    shipmentStatus?: string;
    paymentStatus?: string;
    from?: string | null;
    to?: string | null;
    minTotalInCents?: number | null;
    maxTotalInCents?: number | null;
    orderSort?: "newest" | "oldest" | "total_high" | "total_low";
    page?: number;
    pageSize?: number;
  } = {},
) {
  const pageSize = Math.min(Math.max(input.pageSize ?? 10, 1), 30);
  const requestedPage = Math.max(input.page ?? 1, 1);
  const status = input.status && input.status !== "ALL" ? (input.status as OrderStatus) : undefined;
  const query = input.q?.trim().slice(0, 100);
  const storeQuery = input.storeQ?.trim().slice(0, 100);
  const shipmentStatus =
    input.shipmentStatus && input.shipmentStatus !== "ALL" ? (input.shipmentStatus as ShipmentStatus) : undefined;
  const from = parseOrderDate(input.from, false);
  const to = parseOrderDate(input.to, true);
  const minTotal = typeof input.minTotalInCents === "number" && Number.isSafeInteger(input.minTotalInCents) && input.minTotalInCents >= 0 ? input.minTotalInCents : undefined;
  const maxTotal = typeof input.maxTotalInCents === "number" && Number.isSafeInteger(input.maxTotalInCents) && input.maxTotalInCents >= 0 ? input.maxTotalInCents : undefined;
  const where = {
    userId,
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(minTotal !== undefined || maxTotal !== undefined
      ? { totalAmountInCents: { ...(minTotal !== undefined ? { gte: minTotal } : {}), ...(maxTotal !== undefined ? { lte: maxTotal } : {}) } }
      : {}),
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" as const } },
            {
              sellerOrders: {
                some: {
                  items: {
                    some: {
                      OR: [
                        { productNameSnapshot: { contains: query, mode: "insensitive" as const } },
                        { skuSnapshot: { contains: query, mode: "insensitive" as const } },
                      ],
                    },
                  },
                },
              },
            },
          ],
        }
      : {}),
    ...(storeQuery || shipmentStatus
      ? {
          sellerOrders: {
            some: {
              ...(storeQuery
                ? { storeNameSnapshot: { contains: storeQuery, mode: "insensitive" as const } }
                : {}),
              ...(shipmentStatus ? { shipment: { status: shipmentStatus } } : {}),
            },
          },
        }
      : {}),
    ...(input.paymentStatus && input.paymentStatus !== "ALL"
      ? { payments: { some: { status: input.paymentStatus as PaymentStatus } } }
      : {}),
  };
  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      select: {
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
            items: { select: { id: true } },
            shipment: { select: { status: true, trackingCode: true, trackingUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy:
        input.orderSort === "oldest"
          ? { createdAt: "asc" }
          : input.orderSort === "total_high"
            ? { totalAmountInCents: "desc" }
            : input.orderSort === "total_low"
              ? { totalAmountInCents: "asc" }
              : { createdAt: "desc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { orders, total, page: Math.min(requestedPage, pageCount), pageCount };
}
