import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ShipmentStatus } from "@/generated/prisma/enums";
import { getSellerOrderStatusFromShipment } from "@/modules/orders/domain/fulfillment-status";
import { syncOrderStatusFromSellerOrders } from "@/modules/orders/application/sync-order-status";
import { fulfillmentStatusChangedEventName } from "@/modules/outbox/domain/outbox-events";
import { recordOutboxEvent } from "@/modules/outbox/application/record-outbox-event";
import { ApplicationError } from "@/shared/errors/application-error";

/**
 * Sincroniza o status do `SellerOrder` a partir do envio (com o pedido global travado),
 * registra notificação/auditoria quando o status muda e recalcula o `Order`.
 */
export async function syncFulfillmentStatuses(
  tx: Prisma.TransactionClient,
  sellerOrderId: string,
  shipmentStatus: ShipmentStatus,
  actorUserId: string,
) {
  const reference = await tx.sellerOrder.findUnique({ where: { id: sellerOrderId }, select: { orderId: true } });
  if (!reference) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido do lojista não encontrado." });
  await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${reference.orderId} FOR UPDATE`;

  const sellerOrder = await tx.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    select: { id: true, orderId: true, status: true },
  });
  if (!sellerOrder) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido do lojista não encontrado." });

  const nextSellerOrderStatus = getSellerOrderStatusFromShipment(sellerOrder.status, shipmentStatus);
  if (nextSellerOrderStatus !== sellerOrder.status) {
    await tx.sellerOrder.update({ where: { id: sellerOrder.id }, data: { status: nextSellerOrderStatus } });
    if (isNotificationStatus(nextSellerOrderStatus)) {
      const notification = await tx.sellerOrder.findUnique({
        where: { id: sellerOrder.id },
        select: {
          order: { select: { orderNumber: true } },
          shipment: { select: { trackingCode: true, trackingUrl: true } },
        },
      });
      if (notification) {
        await recordOutboxEvent(tx, {
          eventKey: `seller-order-fulfillment:${sellerOrder.id}:${nextSellerOrderStatus}`,
          eventName: fulfillmentStatusChangedEventName,
          aggregateType: "SELLER_ORDER",
          aggregateId: sellerOrder.id,
          payload: {
            sellerOrderId: sellerOrder.id,
            orderNumber: notification.order.orderNumber,
            status: nextSellerOrderStatus,
            trackingCode: notification.shipment?.trackingCode ?? null,
            trackingUrl: notification.shipment?.trackingUrl ?? null,
          },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        action: "SELLER_ORDER_STATUS_CHANGED",
        entityType: "SELLER_ORDER",
        entityId: sellerOrder.id,
        actorUserId,
        metadata: { previousStatus: sellerOrder.status, nextStatus: nextSellerOrderStatus, shipmentStatus },
      },
    });
  }

  await syncOrderStatusFromSellerOrders(tx, sellerOrder.orderId, "FULFILLMENT", actorUserId);
}

function isNotificationStatus(status: string): status is "PROCESSING" | "SHIPPED" | "DELIVERED" {
  return status === "PROCESSING" || status === "SHIPPED" || status === "DELIVERED";
}
