import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

export type CustomerCancellationIdentity = { userId: string } | { guestAccessTokenHash: string };

export type RequestCancellationInput = {
  orderNumber: string;
  sellerOrderId: string;
  reason: string;
  customerMessage?: string;
  idempotencyKey: string;
  identity: CustomerCancellationIdentity;
};

export async function requestCancellation(input: RequestCancellationInput) {
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
    include: { shipment: true, cancellationRequests: true },
  });
  if (!sellerOrder) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido da loja não encontrado." });
  if (!["PAID", "PROCESSING"].includes(sellerOrder.status)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Este pedido não está mais disponível para cancelamento. Se já foi enviado, solicite uma devolução.",
      statusCode: 409,
    });
  }
  if (sellerOrder.shipment && ["SHIPPED", "IN_TRANSIT", "DELIVERED"].includes(sellerOrder.shipment.status)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O pedido já foi enviado. Solicite uma devolução após o recebimento.",
      statusCode: 409,
    });
  }

  const existing = await db.cancellationRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing;

  const amountInCents = Math.max(
    0,
    sellerOrder.itemsSubtotalInCents - sellerOrder.discountAmountInCents + sellerOrder.customerShippingAmountInCents,
  );
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "seller_orders" WHERE id = ${sellerOrder.id} FOR UPDATE`;
      const locked = await tx.sellerOrder.findUnique({
        where: { id: sellerOrder.id },
        include: { shipment: true },
      });
      if (!locked || !["PAID", "PROCESSING"].includes(locked.status)) {
        throw new ApplicationError({
          code: "CONFLICT",
          message: "O status do pedido mudou durante a solicitação.",
          statusCode: 409,
        });
      }
      const created = await tx.cancellationRequest.create({
        data: {
          status: "REQUESTED",
          reason: input.reason,
          amountInCents,
          ...(input.customerMessage ? { customerMessage: input.customerMessage } : {}),
          previousSellerOrderStatus: locked.status,
          idempotencyKey: input.idempotencyKey,
          orderId: locked.orderId,
          sellerOrderId: locked.id,
          sellerId: locked.sellerId,
          ...("userId" in input.identity ? { requesterUserId: input.identity.userId } : {}),
        },
      });
      await tx.sellerOrder.update({ where: { id: locked.id }, data: { status: "CANCELLATION_REQUESTED" } });
      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrent = await db.cancellationRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (concurrent) return concurrent;
    }
    throw error;
  }
}
