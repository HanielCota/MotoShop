import "server-only";

import { OutboxEventStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";

export async function listFailedOutboxEventsForAdmin() {
  const [total, events] = await Promise.all([
    db.outboxEvent.count({ where: { status: OutboxEventStatus.FAILED } }),
    db.outboxEvent.findMany({
      where: { status: OutboxEventStatus.FAILED },
      select: {
        id: true,
        eventName: true,
        aggregateType: true,
        aggregateId: true,
        attempts: true,
        lastError: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  return { events, total };
}
