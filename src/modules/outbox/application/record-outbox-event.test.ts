import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Prisma } from "@/generated/prisma/client";

import { paymentStatusChangedEventName } from "../domain/outbox-events";
import { recordOutboxEvent } from "./record-outbox-event";

const upsert = vi.fn();
const tx = { outboxEvent: { upsert } } as unknown as Prisma.TransactionClient;
const event = {
  eventKey: "payment:pay-1:APPROVED",
  eventName: paymentStatusChangedEventName,
  aggregateType: "ORDER",
  aggregateId: "order-1",
  payload: { orderNumber: "MS-1", status: "APPROVED" as const, externalId: "mp-1" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

it("records an event once per key: a repeated call changes nothing", async () => {
  await recordOutboxEvent(tx, event);

  expect(upsert).toHaveBeenCalledWith({
    where: { eventKey: "payment:pay-1:APPROVED" },
    update: {},
    create: expect.objectContaining({ eventName: paymentStatusChangedEventName, aggregateId: "order-1" }),
  });
});

it.each(["eventKey", "aggregateType", "aggregateId"] as const)(
  "refuses a blank %s without writing anything",
  async (field) => {
    await expect(recordOutboxEvent(tx, { ...event, [field]: "  " })).rejects.toThrow(
      "Outbox event identity fields must not be empty.",
    );
    expect(upsert).not.toHaveBeenCalled();
  },
);
