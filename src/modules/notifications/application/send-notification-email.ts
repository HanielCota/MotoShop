import "server-only";

import { createHash } from "node:crypto";
import { RetryAfterError } from "inngest";

import { db } from "@/lib/database";
import { ResendEmailProvider } from "@/lib/email/resend-email-provider";
import { logger } from "@/lib/logger";
import type { ReactNode } from "react";

import { NOTIFICATION_PROCESSING_LEASE_MS, notificationLeaseCutoff } from "../domain/notification-delivery-lease";

const resendEmailProvider = new ResendEmailProvider();

export async function sendNotificationEmail(input: {
  eventKey: string;
  kind: string;
  to: string;
  subject: string;
  react: ReactNode;
}): Promise<{ status: "SENT" | "SKIPPED"; providerId?: string }> {
  const claim = await claimNotificationDelivery(input);
  if (claim.status === "ALREADY_SENT") return { status: "SKIPPED" };
  if (claim.status === "IN_FLIGHT") {
    // Another attempt holds a fresh lease. Returning SKIPPED here would lose the
    // e-mail if that worker crashed, so ask Inngest to retry once the lease ends;
    // by then the row is either SENT (skipped) or stale (reclaimed).
    throw new RetryAfterError("Notification delivery is already in progress.", claim.retryAfter);
  }
  const delivery = claim.delivery;

  try {
    const result = await resendEmailProvider.send({
      to: input.to,
      subject: input.subject,
      react: input.react,
      idempotencyKey: createHash("sha256").update(input.eventKey).digest("hex"),
    });
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "SENT", providerId: result.id, sentAt: new Date(), error: null },
    });
    return { status: "SENT", providerId: result.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown notification error";
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", error: message.slice(0, 1000) },
    });
    logger.error({ event: "notification.email.failed", eventKey: input.eventKey, kind: input.kind, error });
    throw error;
  }
}

async function claimNotificationDelivery(input: {
  eventKey: string;
  kind: string;
  to: string;
  subject: string;
  react: ReactNode;
}) {
  const now = new Date();
  const staleBefore = notificationLeaseCutoff(now);

  return db.$transaction(async (tx) => {
    // The advisory-lock function returns PostgreSQL `void`; select a scalar so
    // Prisma can deserialize the result while keeping the transaction lock.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`notification:${input.eventKey}`}, 0))`;
    const current = await tx.notificationDelivery.findUnique({ where: { eventKey: input.eventKey } });
    if (current?.status === "SENT") return { status: "ALREADY_SENT" as const };
    if (current?.status === "PROCESSING" && current.updatedAt > staleBefore) {
      const leaseEndsAt = current.updatedAt.getTime() + NOTIFICATION_PROCESSING_LEASE_MS;
      return { status: "IN_FLIGHT" as const, retryAfter: Math.max(leaseEndsAt - now.getTime(), 0) + 5_000 };
    }

    if (current) {
      const delivery = await tx.notificationDelivery.update({
        where: { id: current.id },
        data: {
          kind: input.kind,
          recipientEmail: input.to,
          subject: input.subject,
          status: "PROCESSING",
          error: null,
        },
      });
      return { status: "CLAIMED" as const, delivery };
    }

    const delivery = await tx.notificationDelivery.create({
      data: {
        eventKey: input.eventKey,
        kind: input.kind,
        recipientEmail: input.to,
        subject: input.subject,
      },
    });
    return { status: "CLAIMED" as const, delivery };
  });
}
