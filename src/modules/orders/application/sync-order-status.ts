import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { getOrderStatusFromSellerOrders } from "@/modules/orders/domain/fulfillment-status";
import { ApplicationError } from "@/shared/errors/application-error";

type OrderStatusTransaction = Prisma.TransactionClient;

export async function syncOrderStatusFromSellerOrders(
  tx: OrderStatusTransaction,
  orderId: string,
  source: "FULFILLMENT" | "CANCELLATION",
  actorUserId?: string,
) {
  await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;

  const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, status: true } });
  if (!order) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido não encontrado." });

  const sellerOrders = await tx.sellerOrder.findMany({ where: { orderId }, select: { status: true } });
  const nextStatus = getOrderStatusFromSellerOrders(sellerOrders.map(({ status }) => status));
  if (nextStatus === order.status) return nextStatus;

  await tx.order.update({ where: { id: orderId }, data: { status: nextStatus } });
  if (actorUserId) {
    await tx.auditLog.create({
      data: {
        action: "ORDER_STATUS_CHANGED",
        entityType: "ORDER",
        entityId: orderId,
        actorUserId,
        metadata: { previousStatus: order.status, nextStatus, source },
      },
    });
  }

  return nextStatus;
}

export type { OrderStatusTransaction };
