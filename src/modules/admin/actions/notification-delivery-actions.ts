"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { retryNotificationDelivery } from "@/modules/notifications/application/retry-notification-delivery";

/**
 * Admin "Reenviar" for FAILED or stale PROCESSING e-mails. Mirrors
 * `retryWebhookEventAction`: usable directly as `<form action={...bind(null, id)}>`.
 * Non-retryable rows are ignored; an enqueue failure is surfaced as an error.
 */
export async function resendNotificationDeliveryAction(deliveryId: string): Promise<void> {
  const session = await requireAdminAccess();
  const parsedId = z.string().cuid().safeParse(deliveryId);
  if (!parsedId.success) return;

  const result = await retryNotificationDelivery({ deliveryId: parsedId.data, actorUserId: session.user.id });
  if (!result.ok && result.reason === "ENQUEUE_FAILED") throw new Error(result.error);
  revalidatePath("/admin", "layout");
}
