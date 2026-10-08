import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

import { getNextDisputeStatus, type DisputeDecision, type DisputeStatus } from "../domain/dispute-status";

export type ReviewDisputeInput = {
  disputeId: string;
  decision: DisputeDecision;
  note?: string;
  actorUserId: string;
};

export type ReviewDisputeResult = { nextStatus: DisputeStatus; orderNumber: string };

export async function reviewDispute(input: ReviewDisputeInput): Promise<ReviewDisputeResult> {
  if (input.decision === "RESOLVE" && !input.note) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "Informe a resolução para concluir a disputa.",
      statusCode: 400,
    });
  }

  const current = await db.dispute.findUnique({
    where: { id: input.disputeId },
    select: { status: true, order: { select: { orderNumber: true } } },
  });
  if (!current) throw new ApplicationError({ code: "NOT_FOUND", message: "Disputa não encontrada.", statusCode: 404 });
  const nextStatus = getNextDisputeStatus(current.status, input.decision);

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "disputes" WHERE id = ${input.disputeId} FOR UPDATE`;
    // Atualização otimista: só aplica se o status lido ainda for o atual.
    const updated = await tx.dispute.updateMany({
      where: { id: input.disputeId, status: current.status },
      data: {
        status: nextStatus,
        ...(input.note !== undefined ? { resolutionNote: input.note } : {}),
        ...(nextStatus === "RESOLVED" || nextStatus === "REJECTED" ? { resolvedByUserId: input.actorUserId } : {}),
      },
    });
    if (updated.count !== 1) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "A disputa foi atualizada por outra operação.",
        statusCode: 409,
      });
    }
    await tx.auditLog.create({
      data: {
        action: `DISPUTE_${nextStatus}`,
        entityType: "DISPUTE",
        entityId: input.disputeId,
        actorUserId: input.actorUserId,
        metadata: {
          previousStatus: current.status,
          nextStatus,
          note: input.note ?? null,
        } as Prisma.InputJsonValue,
      },
    });
  });
  return { nextStatus, orderNumber: current.order.orderNumber };
}
