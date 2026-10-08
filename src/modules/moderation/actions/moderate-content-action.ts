"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { moderateContent } from "@/modules/moderation/application/moderate-content";
import { asApplicationError } from "@/shared/errors/application-error";

const schema = z.object({
  kind: z.enum(["question", "product-review", "seller-review"]),
  id: z.cuid(),
  hide: z.enum(["true", "false"]),
});

export type ModerateContentState = { error?: string; success?: string };

export async function moderateContentAction(
  _previousState: ModerateContentState,
  formData: FormData,
): Promise<ModerateContentState> {
  const session = await requireAdminAccess();
  const parsed = schema.safeParse({ kind: formData.get("kind"), id: formData.get("id"), hide: formData.get("hide") });
  if (!parsed.success) return { error: "Item de moderação inválido." };
  try {
    const result = await moderateContent({
      kind: parsed.data.kind,
      id: parsed.data.id,
      hide: parsed.data.hide === "true",
      actorUserId: session.user.id,
    });
    revalidatePath(result.path);
    revalidatePath("/admin/moderation");
    return { success: parsed.data.hide === "true" ? "Conteúdo ocultado." : "Conteúdo restaurado." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
