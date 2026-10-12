"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/database";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { toActionError } from "@/shared/errors/action-error";

export type NotificationPreferenceActionState = { error?: string; success?: string };

export async function updateNotificationPreferencesAction(
  _previousState: NotificationPreferenceActionState,
  formData: FormData,
): Promise<NotificationPreferenceActionState> {
  const session = await requireAuthenticatedUser("/account/notifications");

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: { emailOrderUpdatesEnabled: formData.get("emailOrderUpdatesEnabled") === "on" },
    });
    revalidatePath("/account/notifications");
    return { success: "Preferências de e-mail atualizadas." };
  } catch (error) {
    return { error: toActionError(error, "updateNotificationPreferencesAction").message };
  }
}
