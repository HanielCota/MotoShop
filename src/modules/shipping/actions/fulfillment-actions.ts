"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { asApplicationError } from "@/shared/errors/application-error";

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
  if (!parsed.success) return { error: "Pedido do lojista inválido." };

  try {
    const shipment = await purchaseSellerOrderShipment({
      ...parsed.data,
      sellerId: context.seller.id,
      actorUserId: context.session.user.id,
    });
    revalidateSellerOrderPaths(parsed.data.sellerOrderId);
    return { success: "Frete comprado e associado ao pedido.", shipmentId: shipment.id };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function generateSellerOrderShipmentAction(input: unknown): Promise<FulfillmentActionState> {
  const context = await requireSellerAccess("ORDER_UPDATE");
  const parsed = sellerOrderIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Pedido do lojista inválido." };

  try {
    const shipment = await generateSellerOrderShipment(
      parsed.data.sellerOrderId,
      context.seller.id,
      context.session.user.id,
    );
    revalidateSellerOrderPaths(parsed.data.sellerOrderId);
    return { success: "Etiqueta gerada.", shipmentId: shipment.id };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function refreshSellerOrderTrackingAction(input: unknown): Promise<FulfillmentActionState> {
  const context = await requireSellerAccess("ORDER_UPDATE");
  const parsed = sellerOrderIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Pedido do lojista inválido." };

  try {
    const shipment = await refreshSellerOrderTracking(
      parsed.data.sellerOrderId,
      context.seller.id,
      context.session.user.id,
    );
    revalidateSellerOrderPaths(parsed.data.sellerOrderId);
    return { success: "Rastreamento atualizado.", shipmentId: shipment.id };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

function revalidateSellerOrderPaths(sellerOrderId: string): void {
  revalidatePath("/seller", "layout");
  revalidatePath("/seller/orders");
  revalidatePath(`/seller/orders/${sellerOrderId}`);
}
