import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  send: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/database", () => ({
  db: {
    webhookEvent: { findFirst: mocks.findFirst, updateMany: mocks.updateMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: mocks.send } }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAdminAccess: vi.fn(async () => ({ user: { id: "admin-a" } })),
}));

import { retryWebhookEventAction } from "./webhook-actions";

const event = {
  id: "webhook-a",
  provider: "MERCADO_PAGO",
  externalId: "external-a",
  type: "payment.updated",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findFirst.mockResolvedValue(event);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.auditCreate.mockResolvedValue({ id: "audit-a" });
  mocks.transaction.mockImplementation((callback) =>
    callback({ webhookEvent: { updateMany: mocks.updateMany }, auditLog: { create: mocks.auditCreate } }),
  );
  mocks.send.mockResolvedValue({ ids: ["job-a"] });
});

describe("retryWebhookEventAction", () => {
  it("claims a failed event and records its audit atomically before enqueueing", async () => {
    await retryWebhookEventAction(event.id);

    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: event.id, status: "FAILED" } });
    expect(mocks.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: event.id, status: "FAILED" },
      data: { status: "RECEIVED", error: null, processedAt: null },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        action: "WEBHOOK_RETRY_REQUESTED",
        entityType: "WebhookEvent",
        entityId: event.id,
        metadata: { provider: event.provider, externalId: event.externalId, type: event.type },
        actorUserId: "admin-a",
      },
    });
    expect(mocks.send).toHaveBeenCalledWith({
      name: "motoshop/payment.webhook.received",
      data: { webhookEventId: event.id },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("does not enqueue or audit when another retry already claimed the event", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await retryWebhookEventAction(event.id);

    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("marks enqueue failure only if the event is still received and propagates the error", async () => {
    const enqueueError = new Error("Inngest indisponível");
    mocks.send.mockRejectedValue(enqueueError);
    mocks.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await expect(retryWebhookEventAction(event.id)).rejects.toBe(enqueueError);

    expect(mocks.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: event.id, status: "RECEIVED" },
      data: { status: "FAILED", error: enqueueError.message },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does nothing when the event is not failed", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await retryWebhookEventAction(event.id);

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
