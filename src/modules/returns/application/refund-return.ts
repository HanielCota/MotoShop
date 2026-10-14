import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

import { returnRefundBaseKey } from "../domain/refund-attempt";
import { refundAuditMetadata, refundPostSaleRequest, type RequestRefundOutcome } from "./refund-request";

export type RefundReturnInput = { returnRequestId: string; actorUserId: string };
export type RefundReturnResult = { outcome: "REFUNDED" | "ALREADY_REFUNDED"; orderNumber: string };

/**
 * Reembolsa uma devolução recebida (RETURNED → REFUNDED). Se uma tentativa anterior foi recusada
 * definitivamente pelo provedor, chamar novamente deriva uma nova chave `:retry-<n>`; tentativas
 * PENDING/SUCCEEDED são reutilizadas para reconciliação idempotente.
 */
export async function refundReturnRequest(input: RefundReturnInput): Promise<RefundReturnResult> {
  const request = await db.returnRequest.findUnique({
    where: { id: input.returnRequestId },
    include: { order: true, sellerOrder: { include: { items: true } } },
  });
  if (!request) throw new ApplicationError({ code: "NOT_FOUND", message: "Solicitação de devolução não encontrada." });
  const orderNumber = request.order.orderNumber;
  if (request.status === "REFUNDED") return { outcome: "ALREADY_REFUNDED", orderNumber };
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

  const refund: RequestRefundOutcome | null =
    request.amountInCents > 0
      ? await refundPostSaleRequest({
          baseKey: returnRefundBaseKey(request.id),
          orderId: request.orderId,
          amountInCents: request.amountInCents,
          reason: `Reembolso da devolução ${request.id}`,
          sellerOrderId: request.sellerOrderId,
        })
      : null;

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
        actorUserId: input.actorUserId,
        metadata: { amountInCents: request.amountInCents, ...refundAuditMetadata(refund) } as Prisma.InputJsonValue,
      },
    });
  });
  return { outcome: "REFUNDED", orderNumber };
}
