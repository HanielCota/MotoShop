import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

export type DisputeIdentity = { userId: string } | { guestAccessTokenHash: string };

export type RequestDisputeInput = {
  orderNumber: string;
  sellerOrderId: string;
  reason: string;
  description: string;
  idempotencyKey: string;
  identity: DisputeIdentity;
};

export async function requestDispute(input: RequestDisputeInput) {
  const sellerOrder = await db.sellerOrder.findFirst({
    where: {
      id: input.sellerOrderId,
      order: {
        orderNumber: input.orderNumber,
        ...("userId" in input.identity
          ? { userId: input.identity.userId }
          : { guestAccessTokenHash: input.identity.guestAccessTokenHash }),
      },
    },
    include: { disputes: { where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } } },
  });
  if (!sellerOrder) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido da loja não encontrado." });
  if (["PENDING_PAYMENT", "CANCELLED", "CANCELLATION_REQUESTED"].includes(sellerOrder.status)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Este pedido não está disponível para abrir uma disputa.",
      statusCode: 409,
    });
  }
  if (sellerOrder.disputes.length > 0) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Já existe uma disputa aberta para este pedido.",
      statusCode: 409,
    });
  }

  const existing = await db.dispute.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing;

  try {
    return await db.dispute.create({
      data: {
        status: "OPEN",
        reason: input.reason,
        description: input.description,
        idempotencyKey: input.idempotencyKey,
        orderId: sellerOrder.orderId,
        sellerOrderId: sellerOrder.id,
        sellerId: sellerOrder.sellerId,
        ...("userId" in input.identity ? { requesterUserId: input.identity.userId } : {}),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrent = await db.dispute.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (concurrent) return concurrent;
    }
    throw error;
  }
}
