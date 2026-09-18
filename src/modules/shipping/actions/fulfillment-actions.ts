"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";

import {
  generateSellerOrderShipment,
  purchaseSellerOrderShipment,
  refreshSellerOrderTracking,
} from "../application/fulfill-seller-order";

const sellerOrderIdSchema = z.object({ sellerOrderId: z.cuid() });

export type FulfillmentActionState = {
  error?: string;
  success?: string;
  shipmentId?: string;
};

export async function purchaseSellerOrderShipmentAction(input: unknown): Promise<FulfillmentActionState> {
  const context = await requireSellerAccess("ORDER_UPDATE");
  const parsed = sellerOrderIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Pedido do seller inválido." };

  try {
    await assertSellerOrderOwnership(parsed.data.sellerOrderId, context.seller.id);
    const shipment = await purchaseSellerOrderShipment({ ...parsed.data, actorUserId: context.session.user.id });
    revalidateSellerOrderPaths(parsed.data.sellerOrderId);
    return { success: "Frete comprado e associado ao pedido.", shipmentId: shipment.id };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function generateSellerOrderShipmentAction(input: unknown): Promise<FulfillmentActionState> {
  const context = await requireSellerAccess("ORDER_UPDATE");
  const parsed = sellerOrderIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Pedido do seller inválido." };

  try {
    await assertSellerOrderOwnership(parsed.data.sellerOrderId, context.seller.id);
    const shipment = await generateSellerOrderShipment(parsed.data.sellerOrderId, context.session.user.id);
    revalidateSellerOrderPaths(parsed.data.sellerOrderId);
    return { success: "Etiqueta gerada.", shipmentId: shipment.id };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function refreshSellerOrderTrackingAction(input: unknown): Promise<FulfillmentActionState> {
  const context = await requireSellerAccess("ORDER_UPDATE");
  const parsed = sellerOrderIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Pedido do seller inválido." };

  try {
    await assertSellerOrderOwnership(parsed.data.sellerOrderId, context.seller.id);
    const shipment = await refreshSellerOrderTracking(parsed.data.sellerOrderId, context.session.user.id);
    revalidateSellerOrderPaths(parsed.data.sellerOrderId);
    return { success: "Rastreamento atualizado.", shipmentId: shipment.id };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

async function assertSellerOrderOwnership(sellerOrderId: string, sellerId: string): Promise<void> {
  const sellerOrder = await db.sellerOrder.findFirst({ where: { id: sellerOrderId, sellerId }, select: { id: true } });
  if (!sellerOrder)
    throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido do seller não encontrado.", statusCode: 404 });
}

function revalidateSellerOrderPaths(sellerOrderId: string): void {
  revalidatePath("/seller");
  revalidatePath("/seller/orders");
  revalidatePath(`/seller/orders/${sellerOrderId}`);
}
