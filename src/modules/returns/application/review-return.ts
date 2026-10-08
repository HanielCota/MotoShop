import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { recordReturnedInventory } from "@/modules/inventory/application/record-return-inventory";
import { ApplicationError } from "@/shared/errors/application-error";

import { getNextReturnStatus, type ReturnReviewDecision } from "../domain/return-status";

export type ReviewReturnInput = {
  returnRequestId: string;
  decision: ReturnReviewDecision;
  note?: string;
  actorUserId: string;
};

export type ReviewReturnResult = { nextStatus: "APPROVED" | "REJECTED" | "RETURNED" };

export async function reviewReturnRequest(input: ReviewReturnInput): Promise<ReviewReturnResult> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "return_requests" WHERE id = ${input.returnRequestId} FOR UPDATE`;
    const request = await tx.returnRequest.findUnique({
      where: { id: input.returnRequestId },
      include: { items: { include: { orderItem: true } } },
    });
    if (!request)
      throw new ApplicationError({ code: "NOT_FOUND", message: "Solicitação de devolução não encontrada." });

    const nextStatus = getNextReturnStatus(request.status, input.decision);
    if (input.decision === "RECEIVE") {
      // Item recebido de volta: o estoque volta com movimentação RETURN rastreável.
      await recordReturnedInventory(
        tx,
        request.items.map((item) => ({
          variantId: item.orderItem.variantId,
          sellerId: item.sellerId,
          quantity: item.quantity,
        })),
        request.id,
        input.actorUserId,
      );
    }

    await tx.returnRequest.update({
      where: { id: request.id },
      data: { status: nextStatus, ...(input.note !== undefined ? { adminNote: input.note } : {}) },
    });
    await tx.auditLog.create({
      data: {
        action: `RETURN_${nextStatus}`,
        entityType: "RETURN_REQUEST",
        entityId: request.id,
        actorUserId: input.actorUserId,
        metadata: {
          previousStatus: request.status,
          nextStatus,
          ...(input.note !== undefined ? { note: input.note } : {}),
        } as Prisma.InputJsonValue,
      },
    });
    return { nextStatus };
  });
}
