import { z } from "zod";
import { env } from "@/config/env";
import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";
import { recoverPayment } from "../application/recover-payment";
import { paymentRecoveryWindow } from "../domain/unresolved-payment";

export const schedulePaymentRecovery = inngest.createFunction(
  { id: "schedule-payment-recovery", retries: 3, triggers: [{ cron: "*/10 * * * *" }] },
  async ({ step }) => {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) return { skipped: true };
    // Frozen once per run (step results are replayed): every page uses the same window.
    const recoveryWindow = await step.run("window", () => {
      const { createdAfter, createdBefore } = paymentRecoveryWindow(new Date());
      return { createdAfter: createdAfter.toISOString(), createdBefore: createdBefore.toISOString() };
    });
    let cursor = "";
    let count = 0;
    // Keyset pagination visits all eligible payments, including those behind
    // long-lived unresolved orders; no oldest-N starvation.
    for (let page = 0; ; page++) {
      const payments = await step.run(`page-${page}`, () =>
        db.payment.findMany({
          where: {
            provider: "MERCADO_PAGO",
            status: { in: ["PENDING", "PROCESSING", "AUTHORIZED"] },
            order: { status: "PENDING_PAYMENT" },
            createdAt: { gte: new Date(recoveryWindow.createdAfter), lt: new Date(recoveryWindow.createdBefore) },
            ...(cursor ? { id: { gt: cursor } } : {}),
          },
          orderBy: { id: "asc" },
          take: 100,
          select: { id: true },
        }),
      );
      const lastPayment = payments.at(-1);
      if (!lastPayment) break;
      await step.sendEvent(
        `dispatch-${page}`,
        payments.map(({ id }) => ({
          name: "motoshop/payment.recovery.requested",
          data: { paymentId: id },
        })),
      );
      count += payments.length;
      cursor = lastPayment.id;
    }
    return { dispatched: count };
  },
);

export const recoverPendingPayment = inngest.createFunction(
  {
    id: "recover-pending-payment",
    retries: 3,
    concurrency: { limit: 5 },
    triggers: [{ event: "motoshop/payment.recovery.requested" }],
  },
  async ({ event, step }) => {
    const { paymentId } = z.object({ paymentId: z.string().min(1) }).parse(event.data);
    return step.run("recover", () => recoverPayment(paymentId));
  },
);
