"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { recordReturnedInventory } from "@/modules/inventory/application/record-return-inventory";
import { refundPayment } from "@/modules/payments/application/refund-payment";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";

const reviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "RECEIVE"]),
  note: z.string().trim().max(1000).optional(),
});

export type ReturnAdminActionState = { error?: string; success?: string };

export async function reviewReturnRequestAction(
  returnRequestId: string,
  formData: FormData,
): Promise<ReturnAdminActionState> {
  const session = await requireAdminAccess();
  const parsed = reviewSchema.safeParse({
    decision: formData.get("decision"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Decisão inválida." };

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "return_requests" WHERE id = ${returnRequestId} FOR UPDATE`;
      const request = await tx.returnRequest.findUnique({
        where: { id: returnRequestId },
        include: { items: { include: { orderItem: true } } },
      });
      if (!request)
        throw new ApplicationError({ code: "NOT_FOUND", message: "Solicitação de devolução não encontrada." });

      const nextStatus = getNextStatus(request.status, parsed.data.decision);
      if (parsed.data.decision === "RECEIVE") {
        await recordReturnedInventory(
          tx,
          request.items.map((item) => ({
            variantId: item.orderItem.variantId,
            sellerId: item.sellerId,
            quantity: item.quantity,
          })),
          request.id,
          session.user.id,
        );
      }

      await tx.returnRequest.update({
        where: { id: request.id },
        data: {
          status: nextStatus,
          ...(parsed.data.note !== undefined ? { adminNote: parsed.data.note } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          action: `RETURN_${nextStatus}`,
          entityType: "RETURN_REQUEST",
          entityId: request.id,
          actorUserId: session.user.id,
          metadata: {
            previousStatus: request.status,
            nextStatus,
            ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
          } as Prisma.InputJsonValue,
        },
      });
    });
    revalidatePath("/admin");
    return { success: "Solicitação atualizada." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function refundReturnRequestAction(returnRequestId: string): Promise<ReturnAdminActionState> {
  const session = await requireAdminAccess();

  try {
    const request = await db.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: { order: true, sellerOrder: { include: { items: true } } },
    });
    if (!request)
      throw new ApplicationError({ code: "NOT_FOUND", message: "Solicitação de devolução não encontrada." });
    if (request.status === "REFUNDED") return { success: "Esta devolução já foi reembolsada." };
    if (request.status !== "RETURNED") {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "Registre o recebimento do item antes de reembolsar.",
        statusCode: 409,
      });
    }

    const itemTotal = request.sellerOrder.items.reduce((sum, item) => sum + item.totalAmountInCents, 0);
    if (itemTotal !== request.sellerOrder.itemsSubtotalInCents - request.sellerOrder.discountAmountInCents) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "Os valores históricos deste pedido precisam de revisão antes do reembolso.",
      });
    }
    if (request.amountInCents > 0)
      await refundPayment({
        orderId: request.orderId,
        amountInCents: request.amountInCents,
        idempotencyKey: `return-refund:${request.id}`,
        reason: `Reembolso da devolução ${request.id}`,
      });
    await db.$transaction(async (tx) => {
      const updated = await tx.returnRequest.updateMany({
        where: { id: request.id, status: "RETURNED" },
        data: { status: "REFUNDED" },
      });
      if (updated.count !== 1) {
        throw new ApplicationError({
          code: "CONFLICT",
          message:
            "A devolução mudou de estado e não foi possível confirmar a conclusão. Verifique o histórico antes de tentar novamente.",
          statusCode: 409,
        });
      }
      await tx.auditLog.create({
        data: {
          action: "RETURN_REFUNDED",
          entityType: "RETURN_REQUEST",
          entityId: request.id,
          actorUserId: session.user.id,
          metadata: { amountInCents: request.amountInCents } as Prisma.InputJsonValue,
        },
      });
    });
    revalidatePath("/admin");
    revalidatePath(`/orders/${request.order.orderNumber}`);
    return { success: "Reembolso processado." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

function getNextStatus(currentStatus: string, decision: "APPROVE" | "REJECT" | "RECEIVE") {
  if (decision === "APPROVE" && ["REQUESTED", "UNDER_REVIEW"].includes(currentStatus)) return "APPROVED" as const;
  if (decision === "REJECT" && ["REQUESTED", "UNDER_REVIEW"].includes(currentStatus)) return "REJECTED" as const;
  if (decision === "RECEIVE" && currentStatus === "APPROVED") return "RETURNED" as const;
  throw new ApplicationError({
    code: "CONFLICT",
    message: "Esta transição de devolução não é permitida.",
    statusCode: 409,
  });
}
