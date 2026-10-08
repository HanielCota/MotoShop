"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { retryableWebhookEventWhere } from "@/modules/payments/domain/webhook-retry";

export async function retryWebhookEventAction(webhookEventId: string): Promise<void> {
  const session = await requireAdminAccess();
  // FAILED events, or PROCESSING events stuck for more than 15 minutes (worker crash
  // before the onFailure handler could run).
  const now = new Date();
  const event = await db.webhookEvent.findFirst({ where: { id: webhookEventId, ...retryableWebhookEventWhere(now) } });
  if (!event) return;

  const claimed = await db.$transaction(async (tx) => {
    const updated = await tx.webhookEvent.updateMany({
      where: { id: event.id, ...retryableWebhookEventWhere(now) },
      data: { status: "RECEIVED", error: null, processedAt: null },
    });
    if (updated.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        action: "WEBHOOK_RETRY_REQUESTED",
        entityType: "WebhookEvent",
        entityId: event.id,
        metadata: {
          provider: event.provider,
          externalId: event.externalId,
          type: event.type,
          previousStatus: event.status,
        },
        actorUserId: session.user.id,
      },
    });
    return true;
  });
  if (!claimed) return;

  try {
    await inngest.send({ name: "motoshop/payment.webhook.received", data: { webhookEventId: event.id } });
  } catch (error) {
    await db.webhookEvent.updateMany({
      where: { id: event.id, status: "RECEIVED" },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message.slice(0, 1000) : "Falha ao reenfileirar.",
      },
    });
    throw error;
  }

  revalidatePath("/admin", "layout");
}
