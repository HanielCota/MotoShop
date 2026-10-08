"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { asApplicationError } from "@/shared/errors/application-error";

import { reviewCancellationRequest } from "../application/review-cancellation";

const reviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(1000).optional(),
});

export type CancellationAdminActionState = { error?: string; success?: string };

const successMessages = {
  REFUNDED: "Cancelamento aprovado, estoque restaurado e reembolso processado.",
  ALREADY_REFUNDED: "Este cancelamento já foi concluído.",
  REJECTED: "Solicitação de cancelamento rejeitada.",
} as const;

export async function reviewCancellationRequestAction(
  cancellationRequestId: string,
  formData: FormData,
): Promise<CancellationAdminActionState> {
  const session = await requireAdminAccess();
  const parsed = reviewSchema.safeParse({
    decision: formData.get("decision"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Decisão inválida." };

  try {
    const result = await reviewCancellationRequest({
      cancellationRequestId,
      decision: parsed.data.decision,
      ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
      actorUserId: session.user.id,
    });
    if (result.outcome !== "ALREADY_REFUNDED") {
      revalidatePath("/admin", "layout");
      revalidatePath(`/orders/${result.orderNumber}`);
    }
    return { success: successMessages[result.outcome] };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
