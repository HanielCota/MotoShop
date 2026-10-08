import "server-only";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";
import { ownShippingMethodSchema, type OwnShippingMethodInput, canAdvanceOwnShipment } from "../domain/own-shipping";
import { syncFulfillmentStatuses } from "@/modules/orders/application/sync-fulfillment-status";

export async function createOwnShippingMethod(sellerId: string, actorUserId: string, input: OwnShippingMethodInput) {
  const data = ownShippingMethodSchema.parse(input);
  return db.$transaction(async (tx) => {
    const method = await tx.sellerShippingMethod.create({ data: { ...data, sellerId } });
    await tx.auditLog.create({
      data: {
        action: "OWN_SHIPPING_CREATED",
        entityType: "SHIPPING_METHOD",
        entityId: method.id,
        actorUserId,
        metadata: { sellerId },
      },
    });
    return method;
  });
}

export async function setOwnShippingMethodActive(sellerId: string, actorUserId: string, id: string, active: boolean) {
  return db.$transaction(async (tx) => {
    const result = await tx.sellerShippingMethod.updateMany({
      where: { id, sellerId, active: !active },
      data: { active },
    });
    if (!result.count) {
      if (await tx.sellerShippingMethod.findFirst({ where: { id, sellerId, active } })) return;
      throw new ApplicationError({ code: "NOT_FOUND", message: "Modalidade de frete não encontrada." });
    }
    await tx.auditLog.create({
      data: {
        action: "OWN_SHIPPING_STATUS_CHANGED",
        entityType: "SHIPPING_METHOD",
        entityId: id,
        actorUserId,
        metadata: { sellerId, active },
      },
    });
  });
}

export async function advanceOwnShipment(input: {
  sellerId: string;
  actorUserId: string;
  sellerOrderId: string;
  status: "SHIPPED" | "DELIVERED";
  trackingCode?: string | undefined;
}) {
  await db.$transaction(async (tx) => {
    // Serialize changes across SellerOrders before recalculating the global order status.
    const scoped = await tx.sellerOrder.findFirst({
      where: { id: input.sellerOrderId, sellerId: input.sellerId },
      select: { orderId: true },
    });
    if (!scoped) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${scoped.orderId} FOR UPDATE`;
    const order = await tx.sellerOrder.findFirst({
      where: { id: input.sellerOrderId, sellerId: input.sellerId },
      include: { shipment: true },
    });
    if (!order?.shipment || order.shipment.provider !== "OWN")
      throw new ApplicationError({ code: "CONFLICT", message: "Este pedido não usa entrega própria." });
    if (order.shipment.status === input.status) return;
    if (!canAdvanceOwnShipment(order.status, order.shipment.status, input.status))
      throw new ApplicationError({
        code: "CONFLICT",
        message: "Não é possível atualizar a entrega neste estado do pedido.",
      });
    await tx.shipment.update({
      where: { id: order.shipment.id },
      data: {
        status: input.status,
        ...(input.status === "SHIPPED"
          ? { shippedAt: new Date(), trackingCode: input.trackingCode || null }
          : { deliveredAt: new Date() }),
      },
    });
    await syncFulfillmentStatuses(tx, order.id, input.status, input.actorUserId);
  });
}
