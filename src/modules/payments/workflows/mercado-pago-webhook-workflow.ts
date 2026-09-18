import { NonRetriableError } from "inngest";

import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";
import { mercadoPagoProvider } from "@/lib/payment/mercado-pago-provider";
import { reconcileMercadoPagoPayment } from "@/modules/payments/application/reconcile-payment";

type PaymentWebhookEventData = { webhookEventId: string };

export const reconcileMercadoPagoWebhook = inngest.createFunction(
  { id: "reconcile-mercado-pago-webhook", retries: 3, triggers: [{ event: "motoshop/payment.webhook.received" }] },
  async ({ event, step }) => {
    const eventData = event.data as PaymentWebhookEventData;
    const webhookEvent = await step.run("load-webhook-event", () =>
      db.webhookEvent.findUnique({ where: { id: eventData.webhookEventId } }),
    );
    if (!webhookEvent) throw new NonRetriableError("Webhook event not found.");

    const externalId = readPaymentId(webhookEvent.payload);
    if (!externalId) {
      await markWebhookFailed(eventData.webhookEventId, "Mercado Pago webhook did not include a payment id.");
      throw new NonRetriableError("Mercado Pago webhook did not include a payment id.");
    }

    await step.run("mark-webhook-processing", () =>
      db.webhookEvent.update({ where: { id: eventData.webhookEventId }, data: { status: "PROCESSING", error: null } }),
    );
    const payment = await step.run("fetch-payment", () => mercadoPagoProvider.getPayment(externalId));
    const { authorizedAt, paidAt, failedAt, ...paymentWithoutDates } = payment;
    return step.run("reconcile-payment", () =>
      reconcileMercadoPagoPayment({
        externalId,
        result: {
          ...paymentWithoutDates,
          ...(authorizedAt ? { authorizedAt: new Date(authorizedAt) } : {}),
          ...(paidAt ? { paidAt: new Date(paidAt) } : {}),
          ...(failedAt ? { failedAt: new Date(failedAt) } : {}),
        },
        webhookEventId: eventData.webhookEventId,
      }),
    );
  },
);

async function markWebhookFailed(webhookEventId: string, error: string): Promise<void> {
  await db.webhookEvent.update({ where: { id: webhookEventId }, data: { status: "FAILED", error } });
}

function readPaymentId(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const data = (payload as Record<string, unknown>).data;
  if (typeof data === "object" && data !== null) {
    const id = (data as Record<string, unknown>).id;
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  const id = (payload as Record<string, unknown>).id;
  return typeof id === "string" || typeof id === "number" ? String(id) : undefined;
}
