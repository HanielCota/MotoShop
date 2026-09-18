"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";
import { requireAdminAccess } from "@/modules/auth/application/authorization";

export async function retryWebhookEventAction(webhookEventId: string): Promise<void> {
  const session = await requireAdminAccess();
  const event = await db.webhookEvent.findFirst({ where: { id: webhookEventId, status: "FAILED" } });
  if (!event) return;

  await db.$transaction([
    db.webhookEvent.update({ where: { id: event.id }, data: { status: "RECEIVED", error: null, processedAt: null } }),
    db.auditLog.create({
      data: {
        action: "WEBHOOK_RETRY_REQUESTED",
        entityType: "WebhookEvent",
        entityId: event.id,
        metadata: { provider: event.provider, externalId: event.externalId, type: event.type },
        actorUserId: session.user.id,
      },
    }),
  ]);

  try {
    await inngest.send({ name: "motoshop/payment.webhook.received", data: { webhookEventId: event.id } });
  } catch (error) {
    await db.webhookEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 1000) : "Falha ao reenfileirar." },
    });
    throw error;
  }

  revalidatePath("/admin");
}
