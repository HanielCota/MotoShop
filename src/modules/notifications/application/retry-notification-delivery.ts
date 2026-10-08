import "server-only";

import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";
import { outboxEventSchemas, type OutboxEventName } from "@/modules/outbox/domain/outbox-events";

import { retryableNotificationDeliveryWhere } from "../domain/notification-delivery-lease";

export type RetryNotificationDeliveryResult =
  { ok: true } | { ok: false; reason: "NOT_RETRYABLE" | "UNSUPPORTED" | "ENQUEUE_FAILED"; error: string };

/**
 * Re-enqueues the workflow that produced a FAILED (or stale PROCESSING) e-mail.
 * The e-mail body is not stored, so the original outbox event (same eventKey) is
 * the source of the payload. Deliveries without an outbox event (e.g. auth links,
 * bound to short-lived tokens) cannot be resent from here.
 */
export async function retryNotificationDelivery(input: {
  deliveryId: string;
  actorUserId: string;
  now?: Date;
}): Promise<RetryNotificationDeliveryResult> {
  const now = input.now ?? new Date();
  const delivery = await db.notificationDelivery.findFirst({
    where: { id: input.deliveryId, ...retryableNotificationDeliveryWhere(now) },
    select: { id: true, eventKey: true, kind: true, status: true },
  });
  if (!delivery) return { ok: false, reason: "NOT_RETRYABLE", error: "Esta notificação não pode ser reenviada agora." };

  const outboxEvent = await db.outboxEvent.findUnique({
    where: { eventKey: delivery.eventKey },
    select: { eventName: true, payload: true },
  });
  const schema = outboxEvent ? outboxEventSchemas[outboxEvent.eventName as OutboxEventName] : undefined;
  const payload = schema?.safeParse(outboxEvent?.payload);
  if (!outboxEvent || !payload?.success) {
    return { ok: false, reason: "UNSUPPORTED", error: "Este tipo de notificação não pode ser reenviado pelo painel." };
  }

  const auditLogId = await db.$transaction(async (tx) => {
    // FAILED makes a stale PROCESSING row immediately claimable by the worker.
    const updated = await tx.notificationDelivery.updateMany({
      where: { id: delivery.id, ...retryableNotificationDeliveryWhere(now) },
      data: { status: "FAILED", error: "Reenvio solicitado pelo Admin." },
    });
    if (updated.count !== 1) return null;
    const audit = await tx.auditLog.create({
      data: {
        action: "NOTIFICATION_RESEND_REQUESTED",
        entityType: "NotificationDelivery",
        entityId: delivery.id,
        metadata: { eventKey: delivery.eventKey, kind: delivery.kind, previousStatus: delivery.status },
        actorUserId: input.actorUserId,
      },
      select: { id: true },
    });
    return audit.id;
  });
  if (!auditLogId)
    return { ok: false, reason: "NOT_RETRYABLE", error: "Esta notificação não pode ser reenviada agora." };

  try {
    // A distinct event id bypasses Inngest's deduplication of the original
    // outbox dispatch (`id: eventKey`); the e-mail itself stays idempotent.
    await inngest.send({
      id: `${delivery.eventKey}:admin-resend:${auditLogId}`,
      name: outboxEvent.eventName as OutboxEventName,
      data: payload.data,
    });
  } catch (error) {
    await db.notificationDelivery.updateMany({
      where: { id: delivery.id, status: "FAILED" },
      data: { error: "Falha ao reenfileirar o reenvio." },
    });
    logger.error({ event: "notification.resend_enqueue_failed", deliveryId: delivery.id, error });
    return { ok: false, reason: "ENQUEUE_FAILED", error: "Não foi possível reenfileirar o reenvio. Tente novamente." };
  }
  return { ok: true };
}
