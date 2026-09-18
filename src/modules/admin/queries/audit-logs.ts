import "server-only";

import { db } from "@/lib/database";

import { parseDateBoundary } from "./date-boundary";

export async function listAuditLogsForAdmin(
  input: {
    action?: string | null;
    entityType?: string | null;
    q?: string | null;
    actorQ?: string | null;
    from?: string | null;
    to?: string | null;
    sort?: "newest" | "oldest";
    page?: number;
  } = {},
) {
  const pageSize = 30;
  const requestedPage = Math.max(input.page ?? 1, 1);
  const action = input.action?.trim();
  const entityType = input.entityType?.trim();
  const query = input.q?.trim().slice(0, 100);
  const actorQuery = input.actorQ?.trim().slice(0, 100);
  const from = parseDateBoundary(input.from, false);
  const to = parseDateBoundary(input.to, true);
  const where = {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(query ? { entityId: { contains: query, mode: "insensitive" as const } } : {}),
    ...(actorQuery
      ? {
          actor: {
            OR: [
              { name: { contains: actorQuery, mode: "insensitive" as const } },
              { email: { contains: actorQuery, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
  };
  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: input.sort === "oldest" ? "asc" : "desc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { logs, total, page: Math.min(requestedPage, pageCount), pageCount };
}
