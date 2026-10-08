import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  deliveryFindFirst: vi.fn(),
  deliveryUpdateMany: vi.fn(),
  outboxFindUnique: vi.fn(),
  auditCreate: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: mocks.send } }));
vi.mock("@/lib/database", () => ({
  db: {
    notificationDelivery: { findFirst: mocks.deliveryFindFirst, updateMany: mocks.deliveryUpdateMany },
    outboxEvent: { findUnique: mocks.outboxFindUnique },
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        notificationDelivery: { updateMany: mocks.deliveryUpdateMany },
        auditLog: { create: mocks.auditCreate },
      }),
  },
}));

import { retryNotificationDelivery } from "./retry-notification-delivery";

const now = new Date("2026-10-07T12:00:00.000Z");
const eventKey = "seller-order-fulfillment:so-1:SHIPPED";
const payload = {
  sellerOrderId: "so-1",
  orderNumber: "MS-202610-0001",
  status: "SHIPPED",
  trackingCode: null,
  trackingUrl: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.deliveryFindFirst.mockResolvedValue({
    id: "delivery-1",
    eventKey,
    kind: "SELLER_ORDER_SHIPPED",
    status: "FAILED",
  });
  mocks.outboxFindUnique.mockResolvedValue({ eventName: "motoshop/seller-order.fulfillment-status.changed", payload });
  mocks.deliveryUpdateMany.mockResolvedValue({ count: 1 });
  mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  mocks.send.mockResolvedValue({ ids: ["evt"] });
});

describe("admin notification resend", () => {
  it("only targets FAILED rows or PROCESSING rows past the lease", async () => {
    await retryNotificationDelivery({ deliveryId: "delivery-1", actorUserId: "admin-a", now });

    expect(mocks.deliveryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "delivery-1",
          OR: [
            { status: "FAILED" },
            { status: "PROCESSING", updatedAt: { lte: new Date("2026-10-07T11:55:00.000Z") } },
          ],
        },
      }),
    );
  });

  it("audits and re-enqueues the original outbox payload with a fresh event id", async () => {
    const result = await retryNotificationDelivery({ deliveryId: "delivery-1", actorUserId: "admin-a", now });

    expect(result).toEqual({ ok: true });
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "NOTIFICATION_RESEND_REQUESTED",
          entityId: "delivery-1",
          actorUserId: "admin-a",
        }),
      }),
    );
    expect(mocks.send).toHaveBeenCalledWith({
      id: `${eventKey}:admin-resend:audit-1`,
      name: "motoshop/seller-order.fulfillment-status.changed",
      data: payload,
    });
  });

  it("refuses deliveries without a replayable outbox event", async () => {
    mocks.outboxFindUnique.mockResolvedValue(null);

    const result = await retryNotificationDelivery({ deliveryId: "delivery-1", actorUserId: "admin-a", now });

    expect(result).toMatchObject({ ok: false, reason: "UNSUPPORTED" });
    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not audit or enqueue when another request already changed the row", async () => {
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 0 });

    const result = await retryNotificationDelivery({ deliveryId: "delivery-1", actorUserId: "admin-a", now });

    expect(result).toMatchObject({ ok: false, reason: "NOT_RETRYABLE" });
    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("keeps the row FAILED with a diagnostic when enqueueing fails", async () => {
    mocks.send.mockRejectedValue(new Error("inngest down"));

    const result = await retryNotificationDelivery({ deliveryId: "delivery-1", actorUserId: "admin-a", now });

    expect(result).toMatchObject({ ok: false, reason: "ENQUEUE_FAILED" });
    expect(mocks.deliveryUpdateMany).toHaveBeenLastCalledWith({
      where: { id: "delivery-1", status: "FAILED" },
      data: { error: "Falha ao reenfileirar o reenvio." },
    });
  });
});
