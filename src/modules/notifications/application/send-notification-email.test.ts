import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lock: vi.fn(), find: vi.fn(), update: vi.fn(), create: vi.fn(), send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/database", () => ({
  db: {
    notificationDelivery: { update: mocks.update },
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        $queryRaw: mocks.lock,
        notificationDelivery: { findUnique: mocks.find, update: mocks.update, create: mocks.create },
      }),
  },
}));
vi.mock("@/lib/email/resend-email-provider", () => ({
  ResendEmailProvider: class {
    send = mocks.send;
  },
}));
import { RetryAfterError } from "inngest";

import { sendNotificationEmail } from "./send-notification-email";
const input = { eventKey: "payment:1", kind: "PAYMENT", to: "buyer@example.test", subject: "Teste", react: "Teste" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.find.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: "delivery" });
  mocks.send.mockResolvedValue({ id: "provider-id" });
});
it("locks the event before claiming and sends a stable provider idempotency key", async () => {
  await sendNotificationEmail(input);
  const key = mocks.send.mock.calls[0]?.[0].idempotencyKey;
  expect(key).toMatch(/^[a-f0-9]{64}$/);
  expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(defined(mocks.find.mock.invocationCallOrder[0]));
  await sendNotificationEmail(input);
  expect(mocks.send.mock.calls[1]?.[0].idempotencyKey).toBe(key);
});
it("does not send an event already delivered", async () => {
  mocks.find.mockResolvedValue({ status: "SENT" });
  await expect(sendNotificationEmail(input)).resolves.toEqual({ status: "SKIPPED" });
  expect(mocks.send).not.toHaveBeenCalled();
});
it("asks Inngest to retry after the lease instead of dropping a fresh in-flight delivery", async () => {
  mocks.find.mockResolvedValue({ id: "delivery", status: "PROCESSING", updatedAt: new Date(Date.now() - 60_000) });
  const error = await sendNotificationEmail(input).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(RetryAfterError);
  // The SDK serializes the delay in seconds.
  const retryAfter = Number((error as RetryAfterError).retryAfter);
  expect(retryAfter).toBeGreaterThanOrEqual(4 * 60 - 1);
  expect(retryAfter).toBeLessThanOrEqual(4 * 60 + 5);
  expect(mocks.send).not.toHaveBeenCalled();
});
it("reclaims a PROCESSING delivery whose lease expired after a worker crash", async () => {
  mocks.find.mockResolvedValue({ id: "delivery", status: "PROCESSING", updatedAt: new Date(Date.now() - 10 * 60_000) });
  mocks.update.mockResolvedValue({ id: "delivery" });
  await expect(sendNotificationEmail(input)).resolves.toEqual({ status: "SENT", providerId: "provider-id" });
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "delivery" }, data: expect.objectContaining({ status: "PROCESSING" }) }),
  );
});

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}
