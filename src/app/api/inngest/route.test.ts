import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ handler: vi.fn(async () => new Response("ok")), error: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("inngest/next", () => ({
  serve: () => ({ GET: mocks.handler, POST: mocks.handler, PUT: mocks.handler }),
}));
vi.mock("@/lib/inngest/client", () => ({ inngest: {} }));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.error } }));
vi.mock("@/modules/payments/workflows/payment-recovery-workflow", () => ({
  schedulePaymentRecovery: {},
  recoverPendingPayment: {},
}));
vi.mock("@/modules/payments/workflows/mercado-pago-webhook-workflow", () => ({ reconcileMercadoPagoWebhook: {} }));
vi.mock("@/modules/notifications/workflows/order-payment-notification-workflow", () => ({
  sendOrderPaymentNotification: {},
}));
vi.mock("@/modules/notifications/workflows/seller-order-fulfillment-notification-workflow", () => ({
  sendSellerOrderFulfillmentNotification: {},
}));
vi.mock("@/modules/outbox/workflows/dispatch-outbox-workflow", () => ({ dispatchPendingOutboxEventsWorkflow: {} }));
vi.mock("@/shared/rate-limit/purge-rate-limits-workflow", () => ({ purgeExpiredRateLimitsWorkflow: {} }));

import { POST, PUT } from "./route";

const request = new Request("http://localhost/api/inngest", { method: "POST" }) as never;

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

it("refuses unsigned dev mode in production without reaching the Inngest handler", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("INNGEST_DEV", "1");
  vi.stubEnv("INNGEST_SIGNING_KEY", "signkey-prod-test");
  const response = await POST(request, {});
  expect(response.status).toBe(503);
  expect(await response.text()).not.toMatch(/INNGEST|stack/i);
  expect(mocks.handler).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith(expect.objectContaining({ event: "inngest.serve_refused" }));
});

it("refuses production without a signing key", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("INNGEST_DEV", "");
  vi.stubEnv("INNGEST_SIGNING_KEY", "");
  expect((await PUT(request, {})).status).toBe(503);
  expect(mocks.handler).not.toHaveBeenCalled();
});

it("delegates to Inngest in signed production mode", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("INNGEST_DEV", "");
  vi.stubEnv("INNGEST_SIGNING_KEY", "signkey-prod-test");
  expect((await POST(request, {})).status).toBe(200);
  expect(mocks.handler).toHaveBeenCalledOnce();
});
