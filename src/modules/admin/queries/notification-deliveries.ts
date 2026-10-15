import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { NotificationDeliveryStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { isNotificationDeliveryRetryable } from "@/modules/notifications/domain/notification-delivery-lease";

import { buildCreatedAtBoundaryFilter } from "./date-boundary";

type NotificationDeliveryListInput = {
  status?: string | null;
  q?: string | null;
  kind?: string | null;
  from?: string | null;
  to?: string | null;
  sort?: "newest" | "oldest";
  page?: number;
};

const pageSize = 20;

/** Somente metadados operacionais: o conteúdo da mensagem nunca é serializado para o Admin. */
const notificationDeliverySelect = {
  id: true,
  eventKey: true,
  kind: true,
  recipientEmail: true,
  subject: true,
  status: true,
  providerId: true,
  error: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NotificationDeliverySelect;

export async function listNotificationDeliveriesForAdmin(input: NotificationDeliveryListInput = {}) {
  const requestedPage = Math.max(input.page ?? 1, 1);
  const where = buildNotificationDeliveryWhere(input);

  const [total, deliveries] = await Promise.all([
    db.notificationDelivery.count({ where }),
    db.notificationDelivery.findMany({
      where,
      select: notificationDeliverySelect,
      orderBy: { createdAt: input.sort === "oldest" ? "asc" : "desc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const now = new Date();
  return {
    deliveries: deliveries.map((delivery) => ({
      ...delivery,
      retryable: isNotificationDeliveryRetryable(delivery, now),
    })),
    total,
    page: Math.min(requestedPage, pageCount),
    pageCount,
  };
}

function buildNotificationDeliveryWhere(input: NotificationDeliveryListInput) {
  const status = input.status && input.status !== "ALL" ? (input.status as NotificationDeliveryStatus) : undefined;
  const query = input.q?.trim().slice(0, 100);
  const kind = input.kind?.trim().slice(0, 100);

  return {
    ...(status ? { status } : {}),
    ...(kind ? { kind: { contains: kind, mode: "insensitive" as const } } : {}),
    ...buildCreatedAtBoundaryFilter(input.from, input.to),
    ...(query ? { OR: buildNotificationDeliverySearch(query) } : {}),
  } satisfies Prisma.NotificationDeliveryWhereInput;
}

function buildNotificationDeliverySearch(query: string) {
  const contains = { contains: query, mode: "insensitive" as const };
  return [
    { eventKey: contains },
    { kind: contains },
    { recipientEmail: contains },
    { subject: contains },
    { error: contains },
  ];
}
