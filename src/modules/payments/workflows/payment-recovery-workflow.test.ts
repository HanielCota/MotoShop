import { beforeEach, expect, it, vi } from "vitest";
const testEnv = vi.hoisted(() => ({ MERCADO_PAGO_ACCESS_TOKEN: "TEST_TOKEN" as string | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({ env: testEnv }));
vi.mock("@/lib/database", () => ({ db: { payment: { findMany: vi.fn() } } }));
vi.mock("../application/recover-payment", () => ({ recoverPayment: vi.fn() }));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { createFunction: (_config: unknown, handler: unknown) => handler },
}));
import { db } from "@/lib/database";
import { recoverPayment } from "../application/recover-payment";
import { schedulePaymentRecovery, recoverPendingPayment } from "./payment-recovery-workflow";

const step = { run: vi.fn(async (_id: string, fn: () => unknown) => fn()), sendEvent: vi.fn() };
// The mock exposes handlers instead of registered Inngest functions.
const schedule = schedulePaymentRecovery as unknown as (input: { step: typeof step }) => Promise<unknown>;
const recover = recoverPendingPayment as unknown as (input: {
  step: typeof step;
  event: { data: unknown };
}) => Promise<unknown>;
beforeEach(() => {
  vi.clearAllMocks();
});
it("paginates all pending payments and dispatches isolated recovery jobs", async () => {
  vi.mocked(db.payment.findMany)
    .mockResolvedValueOnce([{ id: "a" }, { id: "b" }] as never)
    .mockResolvedValueOnce([{ id: "c" }] as never)
    .mockResolvedValueOnce([]);
  expect(await schedule({ step })).toEqual({ dispatched: 3 });
  expect(db.payment.findMany).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      where: expect.objectContaining({
        id: { gt: "b" },
        order: { status: "PENDING_PAYMENT" },
        status: { in: ["PENDING", "PROCESSING", "AUTHORIZED"] },
      }),
      take: 100,
    }),
  );
  expect(step.sendEvent).toHaveBeenCalledTimes(2);
});
it("stops asking the provider about payments older than seven days (A8)", async () => {
  vi.useFakeTimers({ now: new Date("2026-10-17T12:00:00.000Z") });
  try {
    vi.mocked(db.payment.findMany).mockResolvedValueOnce([]);

    expect(await schedule({ step })).toEqual({ dispatched: 0 });
    expect(db.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date("2026-10-10T12:00:00.000Z"),
            lt: new Date("2026-10-17T11:58:00.000Z"),
          },
        }),
      }),
    );
  } finally {
    vi.useRealTimers();
  }
});
it("does nothing without configured credentials", async () => {
  const token = testEnv.MERCADO_PAGO_ACCESS_TOKEN;
  testEnv.MERCADO_PAGO_ACCESS_TOKEN = undefined;
  try {
    expect(await schedule({ step })).toEqual({ skipped: true });
    expect(db.payment.findMany).not.toHaveBeenCalled();
  } finally {
    testEnv.MERCADO_PAGO_ACCESS_TOKEN = token;
  }
});
it("propagates provider failures for durable retries", async () => {
  vi.mocked(recoverPayment).mockRejectedValueOnce(new Error("timeout"));
  await expect(recover({ step, event: { data: { paymentId: "a" } } })).rejects.toThrow("timeout");
});
it("rejects an invalid recovery event", async () => {
  await expect(recover({ step, event: { data: {} } })).rejects.toThrow();
  expect(recoverPayment).not.toHaveBeenCalled();
});
