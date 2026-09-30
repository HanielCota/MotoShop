"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { cancelCommittedInventory } from "@/modules/inventory/application/settle-order-inventory";
import { refundPayment } from "@/modules/payments/application/refund-payment";
import { syncOrderStatusFromSellerOrders } from "@/modules/orders/application/sync-order-status";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";

const reviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(1000).optional(),
});

export type CancellationAdminActionState = { error?: string; success?: string };

export async function reviewCancellationRequestAction(
  cancellationRequestId: string,
  formData: FormData,
): Promise<CancellationAdminActionState> {
  const session = await requireAdminAccess();
  const parsed = reviewSchema.safeParse({
    decision: formData.get("decision"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Decisão inválida." };

  try {
    const request = await db.cancellationRequest.findUnique({
      where: { id: cancellationRequestId },
      include: { sellerOrder: { include: { shipment: true, items: true } }, order: true },
    });
    if (!request)
      throw new ApplicationError({ code: "NOT_FOUND", message: "Solicitação de cancelamento não encontrada." });
    if (request.status === "REFUNDED") return { success: "Este cancelamento já foi concluído." };
    if (request.status === "REJECTED") return { error: "Esta solicitação já foi rejeitada." };

    if (parsed.data.decision === "REJECT") {
      await rejectCancellation(
        request.id,
        request.orderId,
        request.sellerOrderId,
        request.previousSellerOrderStatus,
        parsed.data.note,
        session.user.id,
      );
      revalidateCancellationPaths(request.order.orderNumber);
      return { success: "Solicitação de cancelamento rejeitada." };
    }

    if (!["REQUESTED", "APPROVED"].includes(request.status)) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "Esta solicitação já está em processamento.",
        statusCode: 409,
      });
    }
    if (request.sellerOrder.status !== "CANCELLATION_REQUESTED") {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O status do pedido não permite este cancelamento.",
        statusCode: 409,
      });
    }
    if (
      request.sellerOrder.shipment &&
      ["SHIPPED", "IN_TRANSIT", "DELIVERED"].includes(request.sellerOrder.shipment.status)
    ) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O pedido já foi postado e deve seguir o fluxo de devolução.",
        statusCode: 409,
      });
    }

    if (request.status === "REQUESTED") {
      await db.$transaction(async (tx) => {
        const approved = await tx.cancellationRequest.updateMany({
          where: { id: request.id, status: "REQUESTED" },
          data: { status: "APPROVED", ...(parsed.data.note !== undefined ? { adminNote: parsed.data.note } : {}) },
        });
        if (approved.count !== 1)
          throw new ApplicationError({ code: "CONFLICT", message: "Esta solicitação já foi decidida." });
        await tx.auditLog.create({
          data: {
            action: "CANCELLATION_APPROVED",
            entityType: "CANCELLATION_REQUEST",
            entityId: request.id,
            actorUserId: session.user.id,
            metadata: { previousStatus: request.status } as Prisma.InputJsonValue,
          },
        });
      });
    }

    if (request.amountInCents > 0) {
      await refundPayment({
        orderId: request.orderId,
        amountInCents: request.amountInCents,
        idempotencyKey: `cancellation-refund:${request.id}`,
        reason: `Cancelamento do seller order ${request.sellerOrderId}`,
      });
    }

    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${request.orderId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "cancellation_requests" WHERE id = ${request.id} FOR UPDATE`;
      const current = await tx.cancellationRequest.findUnique({
        where: { id: request.id },
        include: { sellerOrder: { include: { items: true } } },
      });
      if (current?.status === "REFUNDED") return;
      if (!current || current.status !== "APPROVED") {
        throw new ApplicationError({ code: "CONFLICT", message: "O cancelamento já foi finalizado.", statusCode: 409 });
      }

      await cancelCommittedInventory(
        tx,
        [{ sellerId: current.sellerId, items: current.sellerOrder.items }],
        current.id,
      );
      await tx.sellerOrder.update({ where: { id: current.sellerOrderId }, data: { status: "CANCELLED" } });
      await tx.cancellationRequest.update({ where: { id: current.id }, data: { status: "REFUNDED" } });

      await syncOrderStatusFromSellerOrders(tx, current.orderId, "CANCELLATION", session.user.id);
      await tx.auditLog.create({
        data: {
          action: "CANCELLATION_REFUNDED",
          entityType: "CANCELLATION_REQUEST",
          entityId: current.id,
          actorUserId: session.user.id,
          metadata: { amountInCents: current.amountInCents } as Prisma.InputJsonValue,
        },
      });
    });
    revalidateCancellationPaths(request.order.orderNumber);
    return { success: "Cancelamento aprovado, estoque restaurado e reembolso processado." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

async function rejectCancellation(
  id: string,
  orderId: string,
  sellerOrderId: string,
  previousStatus:
    "PENDING_PAYMENT" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLATION_REQUESTED" | "CANCELLED",
  note: string | undefined,
  actorUserId: string,
) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "cancellation_requests" WHERE id = ${id} FOR UPDATE`;
    const updated = await tx.cancellationRequest.updateMany({
      where: { id, status: "REQUESTED" },
      data: { status: "REJECTED", ...(note !== undefined ? { adminNote: note } : {}) },
    });
    if (updated.count !== 1)
      throw new ApplicationError({ code: "CONFLICT", message: "Esta solicitação já foi decidida.", statusCode: 409 });
    const restored = await tx.sellerOrder.updateMany({
      where: { id: sellerOrderId, status: "CANCELLATION_REQUESTED" },
      data: { status: previousStatus === "CANCELLATION_REQUESTED" ? "PROCESSING" : previousStatus },
    });
    if (restored.count !== 1) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O status do pedido mudou e a solicitação não pôde ser rejeitada.",
        statusCode: 409,
      });
    }
    await syncOrderStatusFromSellerOrders(tx, orderId, "CANCELLATION", actorUserId);
    await tx.auditLog.create({
      data: {
        action: "CANCELLATION_REJECTED",
        entityType: "CANCELLATION_REQUEST",
        entityId: id,
        actorUserId,
        metadata: { note: note ?? null } as Prisma.InputJsonValue,
      },
    });
  });
}

function revalidateCancellationPaths(orderNumber: string) {
  revalidatePath("/admin");
  revalidatePath(`/orders/${orderNumber}`);
}
