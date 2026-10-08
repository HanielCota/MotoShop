import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { order: { findUnique: vi.fn() } } }));
vi.mock("@/modules/notifications/application/send-notification-email", () => ({ sendNotificationEmail: vi.fn() }));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { createFunction: (_config: unknown, handler: unknown) => handler },
}));
import { sendOrderPaymentNotification } from "./order-payment-notification-workflow";
import { sendNotificationEmail } from "../application/send-notification-email";

it("never announces an authorization as a captured payment", async () => {
  const handler = sendOrderPaymentNotification as unknown as (input: {
    event: { data: unknown };
    step: { run: ReturnType<typeof vi.fn> };
  }) => Promise<unknown>;
  const step = { run: vi.fn() };
  await expect(
    handler({ event: { data: { orderNumber: "MS-1", externalId: "mp-1", status: "AUTHORIZED" } }, step }),
  ).resolves.toEqual({ status: "SKIPPED" });
  expect(step.run).not.toHaveBeenCalled();
  expect(sendNotificationEmail).not.toHaveBeenCalled();
});
