"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { reconcileShipmentPurchase } from "@/modules/shipping/application/reconcile-shipment-purchase";
import { reconcileShipmentGeneration } from "@/modules/shipping/application/reconcile-shipment-generation";
import { confirmShipmentLabelCancelled } from "@/modules/shipping/application/shipment-label-cancellation";
import { asApplicationError } from "@/shared/errors/application-error";

export type ShipmentRecoveryActionState = { error?: string; success?: string };

const schema = z
  .object({
    shipmentId: z.string().cuid(),
    operation: z.enum(["PURCHASE", "GENERATION"]),
    decision: z.enum([
      "CONFIRMED_PURCHASE",
      "CONFIRMED_NOT_PURCHASED",
      "CONFIRMED_GENERATED",
      "CONFIRMED_NOT_GENERATED",
    ]),
    confirmedOrderNumber: z.string().trim().min(1).max(40),
    externalShipmentId: z.string().trim().max(100).optional(),
  })
  .superRefine((data, context) => {
    const decisionMatchesOperation =
      data.operation === "PURCHASE"
        ? data.decision === "CONFIRMED_PURCHASE" || data.decision === "CONFIRMED_NOT_PURCHASED"
        : data.decision === "CONFIRMED_GENERATED" || data.decision === "CONFIRMED_NOT_GENERATED";
    if (!decisionMatchesOperation) {
      context.addIssue({ code: "custom", message: "A decisão não corresponde à operação selecionada." });
    }
  });

export async function reconcileShipmentPurchaseAction(
  _previousState: ShipmentRecoveryActionState,
  formData: FormData,
): Promise<ShipmentRecoveryActionState> {
  const session = await requireAdminAccess();
  const parsed = schema.safeParse({
    shipmentId: formData.get("shipmentId"),
    operation: formData.get("operation"),
    decision: formData.get("decision"),
    confirmedOrderNumber: formData.get("confirmedOrderNumber"),
    externalShipmentId: formData.get("externalShipmentId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados de reconciliação inválidos." };

  try {
    const { externalShipmentId, operation, ...data } = parsed.data;
    if (operation === "PURCHASE") {
      await reconcileShipmentPurchase({
        ...data,
        decision: data.decision as "CONFIRMED_PURCHASE" | "CONFIRMED_NOT_PURCHASED",
        ...(externalShipmentId ? { externalShipmentId } : {}),
        actorUserId: session.user.id,
      });
    } else {
      await reconcileShipmentGeneration({
        shipmentId: data.shipmentId,
        confirmedOrderNumber: data.confirmedOrderNumber,
        decision: data.decision as "CONFIRMED_GENERATED" | "CONFIRMED_NOT_GENERATED",
        actorUserId: session.user.id,
      });
    }
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/shipping-recovery");
    revalidatePath("/seller/orders");
    return { success: "Tentativa reconciliada e registrada no histórico administrativo." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

const labelCancelledSchema = z.object({
  shipmentId: z.string().cuid(),
  confirmedOrderNumber: z.string().trim().min(1).max(40),
});

/** Admin confirms the label was cancelled at Melhor Envio, clearing the recovery flag (audited). */
export async function confirmShipmentLabelCancelledAction(
  _previousState: ShipmentRecoveryActionState,
  formData: FormData,
): Promise<ShipmentRecoveryActionState> {
  const session = await requireAdminAccess();
  const parsed = labelCancelledSchema.safeParse({
    shipmentId: formData.get("shipmentId"),
    confirmedOrderNumber: formData.get("confirmedOrderNumber"),
  });
  if (!parsed.success) return { error: "Informe o número do pedido para confirmar." };

  try {
    await confirmShipmentLabelCancelled({ ...parsed.data, actorUserId: session.user.id });
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/shipping-recovery");
    return { success: "Cancelamento da etiqueta confirmado e registrado no histórico administrativo." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
