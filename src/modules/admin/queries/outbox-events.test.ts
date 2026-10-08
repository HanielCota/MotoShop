import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { outboxEvent: mocks } }));

import { OutboxEventStatus } from "@/generated/prisma/enums";
import { listFailedOutboxEventsForAdmin } from "./outbox-events";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.count.mockResolvedValue(1);
  mocks.findMany.mockResolvedValue([
    {
      id: "outbox-event-1",
      eventName: "motoshop/order.payment-status.changed",
      aggregateType: "Order",
      aggregateId: "order-1",
      attempts: 12,
      lastError: "Error",
      updatedAt: new Date("2026-10-02T12:00:00.000Z"),
    },
  ]);
});

it("lists only failed events and selects operational metadata without the payload", async () => {
  const result = await listFailedOutboxEventsForAdmin();

  expect(result).toMatchObject({ total: 1, events: [{ id: "outbox-event-1", attempts: 12 }] });
  expect(mocks.count).toHaveBeenCalledWith({ where: { status: OutboxEventStatus.FAILED } });
  expect(mocks.findMany).toHaveBeenCalledWith({
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
  });
  expect(mocks.findMany.mock.calls[0]?.[0].select).not.toHaveProperty("payload");
});
