import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";

export type IngestWebhookResult =
  | { outcome: "ENQUEUED"; duplicate: boolean }
  | { outcome: "ALREADY_PROCESSED" }
  | { outcome: "PERSISTENCE_FAILED" }
  | { outcome: "ENQUEUE_FAILED" };

/**
 * Persists a verified Mercado Pago notification (UNIQUE(provider, externalId) detects
 * redeliveries) and hands it to the reconciliation workflow. Already processed events
 * are not enqueued again; anything else is (re)enqueued so redeliveries can recover a
 * previously failed enqueue.
 */
export async function ingestMercadoPagoWebhook(input: {
  notificationId: string;
  type: string;
  payload: Record<string, unknown>;
}): Promise<IngestWebhookResult> {
  let webhookEvent;
  let duplicate = false;
  try {
    webhookEvent = await db.webhookEvent.create({
      data: {
        provider: "MERCADO_PAGO",
        externalId: input.notificationId,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      duplicate = true;
      webhookEvent = await db.webhookEvent.findUnique({
        where: { provider_externalId: { provider: "MERCADO_PAGO", externalId: input.notificationId } },
      });
    } else {
      return { outcome: "PERSISTENCE_FAILED" };
    }
  }

  if (!webhookEvent) return { outcome: "PERSISTENCE_FAILED" };
  if (webhookEvent.status === "PROCESSED") return { outcome: "ALREADY_PROCESSED" };
  try {
    await inngest.send({ name: "motoshop/payment.webhook.received", data: { webhookEventId: webhookEvent.id } });
  } catch {
    await db.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "FAILED", error: "Could not enqueue webhook workflow." },
    });
    return { outcome: "ENQUEUE_FAILED" };
  }
  return { outcome: "ENQUEUED", duplicate };
}
