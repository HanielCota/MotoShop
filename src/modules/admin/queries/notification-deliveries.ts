import "server-only";

import { NotificationDeliveryStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";

import { parseDateBoundary } from "./date-boundary";

export async function listNotificationDeliveriesForAdmin(input: {
  status?: string | null;
  q?: string | null;
  kind?: string | null;
  from?: string | null;
  to?: string | null;
  sort?: "newest" | "oldest";
  page?: number;
} = {}) {
  const pageSize = 20;
  const requestedPage = Math.max(input.page ?? 1, 1);
  const status = input.status && input.status !== "ALL" ? (input.status as NotificationDeliveryStatus) : undefined;
  const query = input.q?.trim().slice(0, 100);
  const kind = input.kind?.trim().slice(0, 100);
  const from = parseDateBoundary(input.from, false);
  const to = parseDateBoundary(input.to, true);
  const where = {
    ...(status ? { status } : {}),
    ...(kind ? { kind: { contains: kind, mode: "insensitive" as const } } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(query
      ? {
          OR: [
            { eventKey: { contains: query, mode: "insensitive" as const } },
            { kind: { contains: query, mode: "insensitive" as const } },
            { recipientEmail: { contains: query, mode: "insensitive" as const } },
            { subject: { contains: query, mode: "insensitive" as const } },
            { error: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [total, deliveries] = await Promise.all([
    db.notificationDelivery.count({ where }),
    db.notificationDelivery.findMany({
      where,
      select: { id: true, eventKey: true, kind: true, recipientEmail: true, subject: true, status: true, providerId: true, error: true, sentAt: true, createdAt: true },
      orderBy: { createdAt: input.sort === "oldest" ? "asc" : "desc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { deliveries, total, page: Math.min(requestedPage, pageCount), pageCount };
}
