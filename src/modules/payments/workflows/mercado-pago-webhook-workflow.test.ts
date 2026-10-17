import { beforeEach, expect, it, vi } from "vitest";

// Plain array instead of a vi.fn(): createFunction runs at import time, and Vitest 5 clears mock
// call history before every test (clearMocks is on by default).
const mocks = vi.hoisted(() => ({ updateMany: vi.fn(), createdFunctions: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { webhookEvent: { updateMany: mocks.updateMany } } }));
vi.mock("@/lib/payment/mercado-pago-provider", () => ({ mercadoPagoProvider: { getPayment: vi.fn() } }));
vi.mock("@/modules/payments/application/reconcile-payment", () => ({ reconcileMercadoPagoPayment: vi.fn() }));
vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: (config: unknown, handler: unknown) => {
      mocks.createdFunctions.push(config);
      return handler;
    },
  },
}));

import { STALE_WEBHOOK_PROCESSING_MS } from "../domain/webhook-retry";
import { markWebhookEventFailedAfterRetries } from "./mercado-pago-webhook-workflow";

const failureEvent = (data: unknown) => ({ data: { event: { data } } });

beforeEach(() => {
  mocks.updateMany.mockReset();
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

it("registers the failure handler on the webhook reconciliation function", () => {
  expect(mocks.createdFunctions).toContainEqual(
    expect.objectContaining({ id: "reconcile-mercado-pago-webhook", onFailure: markWebhookEventFailedAfterRetries }),
  );
});

it("cancels a hung webhook run at the mark the Admin retry accepts it as stuck (A10)", () => {
  expect(mocks.createdFunctions).toContainEqual(
    expect.objectContaining({ id: "reconcile-mercado-pago-webhook", timeouts: { finish: "15m" } }),
  );
  expect(STALE_WEBHOOK_PROCESSING_MS).toBe(15 * 60 * 1000);
});

it("marks a webhook stuck in PROCESSING as FAILED with the final error", async () => {
  await markWebhookEventFailedAfterRetries({
    event: failureEvent({ webhookEventId: "event-1" }),
    error: new Error("gateway timeout"),
  });
  expect(mocks.updateMany).toHaveBeenCalledWith({
    where: { id: "event-1", status: { in: ["RECEIVED", "PROCESSING"] } },
    data: {
      status: "FAILED",
      processedAt: null,
      error: expect.stringContaining("gateway timeout"),
    },
  });
});

it("ignores failure events without a webhook id", async () => {
  await markWebhookEventFailedAfterRetries({ event: failureEvent({}), error: new Error("x") });
  expect(mocks.updateMany).not.toHaveBeenCalled();
});
