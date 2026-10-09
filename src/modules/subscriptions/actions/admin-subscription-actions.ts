"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { asApplicationError } from "@/shared/errors/application-error";

import { activateVipSubscription } from "../application/activate-vip-subscription";

const subscriptionSchema = z.object({
  sellerId: z.string().min(1, "Selecione a loja."),
  months: z.coerce
    .number({ error: "Informe a duração em meses, de 1 a 12." })
    .int("Informe a duração em meses, de 1 a 12.")
    .min(1, "Informe a duração em meses, de 1 a 12.")
    .max(12, "Informe a duração em meses, de 1 a 12."),
});

export type SubscriptionActionState = { error?: string; success?: string };

export async function activateVipSubscriptionAction(
  _previousState: SubscriptionActionState,
  formData: FormData,
): Promise<SubscriptionActionState> {
  const session = await requireAdminAccess();
  const parsed = subscriptionSchema.safeParse({
    sellerId: formData.get("sellerId"),
    months: formData.get("months"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do plano VIP." };

  try {
    await activateVipSubscription(session.user.id, parsed.data);

    revalidatePath("/admin", "layout");
    revalidatePath("/seller", "layout");
    revalidatePath("/products");
    return { success: "Plano VIP ativado/renovado." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
