import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

const ACTIVE_RETURN_STATUSES = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "WAITING_RETURN",
  "RETURNED",
  "REFUNDED",
] as const;

export type CustomerOrderIdentity = { userId: string } | { guestAccessTokenHash: string };

export type RequestReturnInput = {
  orderNumber: string;
  orderItemId: string;
  quantity: number;
  reason: string;
  customerMessage?: string;
  idempotencyKey: string;
  identity: CustomerOrderIdentity;
};

export type ReturnRequestResult = {
  id: string;
  orderNumber: string;
  orderItemId: string;
  quantity: number;
  status: string;
};

export async function requestReturn(input: RequestReturnInput): Promise<ReturnRequestResult> {
  assertInput(input);
  const orderItem = await findAuthorizedOrderItem(input);
  if (!orderItem)
    throw new ApplicationError({ code: "NOT_FOUND", message: "Item do pedido não encontrado.", statusCode: 404 });
  if (["PENDING_PAYMENT", "CANCELLED", "CANCELLATION_REQUESTED"].includes(orderItem.sellerOrder.status)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Este item ainda não pode receber uma solicitação de devolução.",
      statusCode: 409,
    });
  }

  const existingRequest = await db.returnRequest.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { items: true, order: true },
  });
  if (existingRequest) {
    assertSameRequestTarget(existingRequest, orderItem.sellerOrder.orderId, input.orderItemId);
    return toResult(existingRequest, input.orderItemId);
  }

  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderItem.sellerOrder.orderId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "seller_orders" WHERE id = ${orderItem.sellerOrderId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "order_items" WHERE id = ${orderItem.id} FOR UPDATE`;
      const replay = await tx.returnRequest.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { items: true, order: true },
      });
      if (replay) {
        assertSameRequestTarget(replay, orderItem.sellerOrder.orderId, input.orderItemId);
        return toResult(replay, input.orderItemId);
      }
      const lockedItem = await tx.orderItem.findUnique({
        where: { id: orderItem.id },
        include: { sellerOrder: { include: { order: true } }, returnItems: { include: { returnRequest: true } } },
      });
      if (!lockedItem) throw new ApplicationError({ code: "NOT_FOUND", message: "Item do pedido não encontrado." });
      if (["PENDING_PAYMENT", "CANCELLED", "CANCELLATION_REQUESTED"].includes(lockedItem.sellerOrder.status)) {
        throw new ApplicationError({ code: "CONFLICT", message: "O status do pedido mudou durante a solicitação." });
      }
      const itemTotals = await tx.orderItem.aggregate({
        where: { sellerOrderId: lockedItem.sellerOrderId },
        _sum: { totalAmountInCents: true },
      });
      if (
        itemTotals._sum.totalAmountInCents !==
        lockedItem.sellerOrder.itemsSubtotalInCents - lockedItem.sellerOrder.discountAmountInCents
      ) {
        throw new ApplicationError({
          code: "CONFLICT",
          message: "Os valores deste pedido precisam de revisão pela Moto Shop antes da devolução.",
        });
      }

      const activeReturnItems = lockedItem.returnItems.filter((item) =>
        ACTIVE_RETURN_STATUSES.includes(item.returnRequest.status as (typeof ACTIVE_RETURN_STATUSES)[number]),
      );
      const requestedQuantity = activeReturnItems.reduce((total, item) => total + item.quantity, 0);
      const requestedAmountInCents = activeReturnItems.reduce(
        (total, item) => total + item.returnRequest.amountInCents,
        0,
      );
      const availableQuantity = lockedItem.quantity - requestedQuantity;
      if (input.quantity > availableQuantity) {
        throw new ApplicationError({
          code: "CONFLICT",
          message: "A quantidade solicitada já possui devoluções em andamento.",
          statusCode: 409,
        });
      }

      const created = await tx.returnRequest.create({
        data: {
          status: "REQUESTED",
          reason: input.reason,
          amountInCents:
            input.quantity === availableQuantity
              ? lockedItem.totalAmountInCents - requestedAmountInCents
              : Math.floor((lockedItem.totalAmountInCents * input.quantity) / lockedItem.quantity),
          ...(input.customerMessage ? { customerMessage: input.customerMessage } : {}),
          idempotencyKey: input.idempotencyKey,
          orderId: lockedItem.sellerOrder.orderId,
          sellerOrderId: lockedItem.sellerOrderId,
          sellerId: lockedItem.sellerId,
          ...("userId" in input.identity ? { requesterUserId: input.identity.userId } : {}),
          items: {
            create: {
              quantity: input.quantity,
              orderItemId: lockedItem.id,
              sellerOrderId: lockedItem.sellerOrderId,
              sellerId: lockedItem.sellerId,
            },
          },
        },
        include: { items: true, order: true },
      });
      return toResult(created, lockedItem.id);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentRequest = await db.returnRequest.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { items: true, order: true },
      });
      if (concurrentRequest) {
        assertSameRequestTarget(concurrentRequest, orderItem.sellerOrder.orderId, input.orderItemId);
        return toResult(concurrentRequest, input.orderItemId);
      }
    }
    throw error;
  }
}

function assertSameRequestTarget(
  request: { orderId: string; items: Array<{ orderItemId: string }> },
  orderId: string,
  orderItemId: string,
): void {
  if (request.orderId !== orderId || !request.items.some((item) => item.orderItemId === orderItemId)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A chave de idempotência já foi utilizada em outra solicitação.",
      statusCode: 409,
    });
  }
}

async function findAuthorizedOrderItem(input: RequestReturnInput) {
  return db.orderItem.findFirst({
    where: {
      id: input.orderItemId,
      sellerOrder: {
        order: {
          orderNumber: input.orderNumber,
          ...("userId" in input.identity
            ? { userId: input.identity.userId }
            : { guestAccessTokenHash: input.identity.guestAccessTokenHash }),
        },
      },
    },
    include: { sellerOrder: true },
  });
}

function assertInput(input: RequestReturnInput): void {
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Informe uma quantidade válida." });
  }
  if (!input.orderNumber || !input.orderItemId || !input.idempotencyKey || !input.reason) {
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Preencha os dados da devolução." });
  }
}

function toResult(
  request: {
    id: string;
    status: string;
    order: { orderNumber: string };
    items: Array<{ orderItemId: string; quantity: number }>;
  },
  orderItemId: string,
): ReturnRequestResult {
  const item = request.items.find((candidate) => candidate.orderItemId === orderItemId);
  if (!item) throw new ApplicationError({ code: "CONFLICT", message: "A devolução não contém o item solicitado." });
  return {
    id: request.id,
    orderNumber: request.order.orderNumber,
    orderItemId,
    quantity: item.quantity,
    status: request.status,
  };
}
