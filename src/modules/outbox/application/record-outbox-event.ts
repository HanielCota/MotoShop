import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { OutboxEventName, OutboxEventPayload } from "../domain/outbox-events";

export async function recordOutboxEvent<Name extends OutboxEventName>(
  tx: Prisma.TransactionClient,
  input: {
    eventKey: string;
    eventName: Name;
    aggregateType: string;
    aggregateId: string;
    payload: OutboxEventPayload<Name>;
  },
) {
  if (!input.eventKey.trim() || !input.aggregateType.trim() || !input.aggregateId.trim()) {
    throw new Error("Outbox event identity fields must not be empty.");
  }

  await tx.outboxEvent.upsert({
    where: { eventKey: input.eventKey },
    update: {},
    create: {
      eventKey: input.eventKey,
      eventName: input.eventName,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: input.payload as Prisma.InputJsonValue,
    },
  });
}
