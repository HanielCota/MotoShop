"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";

import { getNextDisputeStatus, type DisputeDecision } from "../domain/dispute-status";

const reviewSchema = z.object({
  decision: z.enum(["START_REVIEW", "RESOLVE", "REJECT"]),
  note: z.string().trim().max(2000).optional(),
});

export type DisputeAdminActionState = { error?: string; success?: string };

export async function reviewDisputeAction(disputeId: string, formData: FormData): Promise<DisputeAdminActionState> {
  const session = await requireAdminAccess();
  const parsed = reviewSchema.safeParse({
    decision: formData.get("decision"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Decisão inválida." };
  if (parsed.data.decision === "RESOLVE" && !parsed.data.note)
    return { error: "Informe a resolução para concluir a disputa." };

  try {
    const current = await db.dispute.findUnique({ where: { id: disputeId }, include: { order: true } });
    if (!current) throw new ApplicationError({ code: "NOT_FOUND", message: "Disputa não encontrada." });
    const nextStatus = getNextDisputeStatus(current.status, parsed.data.decision as DisputeDecision);

    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "disputes" WHERE id = ${disputeId} FOR UPDATE`;
      const updated = await tx.dispute.updateMany({
        where: { id: disputeId, status: current.status },
        data: {
          status: nextStatus,
          ...(parsed.data.note !== undefined ? { resolutionNote: parsed.data.note } : {}),
          ...(nextStatus === "RESOLVED" || nextStatus === "REJECTED" ? { resolvedByUserId: session.user.id } : {}),
        },
      });
      if (updated.count !== 1)
        throw new ApplicationError({
          code: "CONFLICT",
          message: "A disputa foi atualizada por outra operação.",
          statusCode: 409,
        });
      await tx.auditLog.create({
        data: {
          action: `DISPUTE_${nextStatus}`,
          entityType: "DISPUTE",
          entityId: disputeId,
          actorUserId: session.user.id,
          metadata: {
            previousStatus: current.status,
            nextStatus,
            note: parsed.data.note ?? null,
          } as Prisma.InputJsonValue,
        },
      });
    });
    revalidatePath("/admin");
    revalidatePath(`/orders/${current.order.orderNumber}`);
    return {
      success: `Disputa ${nextStatus === "UNDER_REVIEW" ? "assumida para análise" : nextStatus === "RESOLVED" ? "resolvida" : "rejeitada"}.`,
    };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
