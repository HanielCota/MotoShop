import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ResendEmailProvider } from "@/lib/email/resend-email-provider";
import { logger } from "@/lib/logger";
import type { ReactNode } from "react";

const resendEmailProvider = new ResendEmailProvider();
const staleProcessingWindowInMilliseconds = 5 * 60 * 1000;

export async function sendNotificationEmail(input: {
  eventKey: string;
  kind: string;
  to: string;
  subject: string;
  react: ReactNode;
}): Promise<{ status: "SENT" | "SKIPPED"; providerId?: string }> {
  const delivery = await claimNotificationDelivery(input);
  if (!delivery) return { status: "SKIPPED" };

  try {
    const result = await resendEmailProvider.send({ to: input.to, subject: input.subject, react: input.react });
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
  const staleBefore = new Date(Date.now() - staleProcessingWindowInMilliseconds);

  return db.$transaction(async (tx) => {
    const current = await tx.notificationDelivery.findUnique({ where: { eventKey: input.eventKey } });
    if (current?.status === "SENT") return null;
    if (current?.status === "PROCESSING" && current.updatedAt > staleBefore) return null;

    if (current) {
      return tx.notificationDelivery.update({
        where: { id: current.id },
        data: {
          kind: input.kind,
          recipientEmail: input.to,
          subject: input.subject,
          status: "PROCESSING",
          error: null,
        },
      });
    }

    try {
      return await tx.notificationDelivery.create({
        data: {
          eventKey: input.eventKey,
          kind: input.kind,
          recipientEmail: input.to,
          subject: input.subject,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
      throw error;
    }
  });
}
