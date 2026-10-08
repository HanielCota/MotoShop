import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  send: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { outboxEvent: { findMany: mocks.findMany, updateMany: mocks.updateMany } } }));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: mocks.send } }));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.loggerError } }));

import { dispatchPendingOutboxEvents } from "./dispatch-outbox-events";

const event = {
  id: "outbox-1",
  eventKey: "seller-order-fulfillment:seller-order-1:SHIPPED",
  eventName: "motoshop/seller-order.fulfillment-status.changed",
  aggregateType: "SELLER_ORDER",
  aggregateId: "seller-order-1",
  payload: {
    sellerOrderId: "seller-order-1",
    orderNumber: "MS-202610-1",
    status: "SHIPPED",
    trackingCode: "TRACK-1",
    trackingUrl: "https://tracking.example.test/track-1",
  },
  status: "PENDING",
  attempts: 0,
  claimedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([event]);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.send.mockResolvedValue({ ids: ["inngest-1"] });
});

describe("durable outbox dispatch", () => {
  it("claims, idempotently sends and marks an event dispatched", async () => {
    const result = await dispatchPendingOutboxEvents(new Date("2026-10-02T12:00:00.000Z"));

    expect(result).toEqual({ considered: 1, dispatched: 1, failed: 0, skipped: 0 });
    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: event.id, status: "PENDING" },
        data: expect.objectContaining({ status: "PROCESSING", attempts: { increment: 1 } }),
      }),
    );
    expect(mocks.send).toHaveBeenCalledWith({
      id: event.eventKey,
      name: event.eventName,
      data: event.payload,
    });
    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: event.id, status: "PROCESSING" }),
        data: expect.objectContaining({ status: "DISPATCHED", dispatchedAt: expect.any(Date) }),
      }),
    );
  });

  it("keeps a transient send failure retryable without persisting error details", async () => {
    mocks.send.mockRejectedValueOnce(new Error("provider response contained private details"));

    const result = await dispatchPendingOutboxEvents(new Date("2026-10-02T12:00:00.000Z"));

    expect(result).toEqual({ considered: 1, dispatched: 0, failed: 1, skipped: 0 });
    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: event.id, status: "PROCESSING" }),
        data: expect.objectContaining({ status: "PENDING", lastError: "Error", availableAt: expect.any(Date) }),
      }),
    );
    expect(JSON.stringify(mocks.updateMany.mock.calls)).not.toContain("private details");
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ event: "outbox.dispatch_failed_retryable", errorName: "Error" }),
      expect.any(String),
    );
  });

  it("marks an event terminally failed after the final bounded attempt", async () => {
    mocks.findMany.mockResolvedValueOnce([{ ...event, attempts: 11 }]);
    mocks.send.mockRejectedValueOnce(new Error("temporary provider outage"));

    const result = await dispatchPendingOutboxEvents(new Date("2026-10-02T12:00:00.000Z"));

    expect(result).toEqual({ considered: 1, dispatched: 0, failed: 1, skipped: 0 });
    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", lastError: "Error", claimedAt: null }),
      }),
    );
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ event: "outbox.dispatch_failed_terminally", attempts: 12 }),
      expect.any(String),
    );
  });

  it("moves unsupported event payloads to a visible terminal failure instead of publishing them", async () => {
    mocks.findMany.mockResolvedValueOnce([{ ...event, payload: { unexpected: true } }]);

    const result = await dispatchPendingOutboxEvents();

    expect(result).toEqual({ considered: 1, dispatched: 0, failed: 1, skipped: 0 });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", lastError: expect.stringMatching(/invalid payload/i) }),
      }),
    );
  });

  it("does not publish a row claimed by a concurrent dispatcher", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await dispatchPendingOutboxEvents();

    expect(result).toEqual({ considered: 1, dispatched: 0, failed: 0, skipped: 1 });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
