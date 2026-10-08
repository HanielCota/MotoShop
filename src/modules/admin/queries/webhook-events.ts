import "server-only";

import { WebhookEventStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";

import { parseDateBoundary } from "./date-boundary";

export async function listWebhookEventsForAdmin(
  input: {
    status?: string | null;
    q?: string | null;
    provider?: string | null;
    from?: string | null;
    to?: string | null;
    sort?: "newest" | "oldest";
    page?: number;
  } = {},
) {
  const pageSize = 20;
  const requestedPage = Math.max(input.page ?? 1, 1);
  const status = input.status && input.status !== "ALL" ? (input.status as WebhookEventStatus) : undefined;
  const query = input.q?.trim().slice(0, 100);
  const provider = input.provider?.trim().slice(0, 100);
  const from = parseDateBoundary(input.from, false);
  const to = parseDateBoundary(input.to, true);
  const where = {
    ...(status ? { status } : {}),
    ...(provider ? { provider: { contains: provider, mode: "insensitive" as const } } : {}),
    ...(from || to ? { receivedAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(query
      ? {
          OR: [
            { externalId: { contains: query, mode: "insensitive" as const } },
            { type: { contains: query, mode: "insensitive" as const } },
            { error: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [total, events] = await Promise.all([
    db.webhookEvent.count({ where }),
    db.webhookEvent.findMany({
      where,
      select: {
        id: true,
        provider: true,
        externalId: true,
        type: true,
        status: true,
        receivedAt: true,
        processedAt: true,
        error: true,
      },
      orderBy: { receivedAt: input.sort === "oldest" ? "asc" : "desc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { events, total, page: Math.min(requestedPage, pageCount), pageCount };
}
