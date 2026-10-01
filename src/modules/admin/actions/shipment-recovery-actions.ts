"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { reconcileShipmentPurchase } from "@/modules/shipping/application/reconcile-shipment-purchase";
import { asApplicationError } from "@/shared/errors/application-error";

export type ShipmentRecoveryActionState = { error?: string; success?: string };

const schema = z.object({
  shipmentId: z.string().cuid(),
  decision: z.enum(["CONFIRMED_PURCHASE", "CONFIRMED_NOT_PURCHASED"]),
  confirmedOrderNumber: z.string().trim().min(1).max(40),
  externalShipmentId: z.string().trim().max(100).optional(),
});

export async function reconcileShipmentPurchaseAction(
  _previousState: ShipmentRecoveryActionState,
  formData: FormData,
): Promise<ShipmentRecoveryActionState> {
  const session = await requireAdminAccess();
  const parsed = schema.safeParse({
    shipmentId: formData.get("shipmentId"),
    decision: formData.get("decision"),
    confirmedOrderNumber: formData.get("confirmedOrderNumber"),
    externalShipmentId: formData.get("externalShipmentId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados de reconciliação inválidos." };

  try {
    const { externalShipmentId, ...data } = parsed.data;
    await reconcileShipmentPurchase({
      ...data,
      ...(externalShipmentId ? { externalShipmentId } : {}),
      actorUserId: session.user.id,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/shipping-recovery");
    revalidatePath("/seller/orders");
    return { success: "Tentativa reconciliada e registrada no histórico administrativo." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
