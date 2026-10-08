"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { asApplicationError } from "@/shared/errors/application-error";

import { refundReturnRequest } from "../application/refund-return";
import { reviewReturnRequest } from "../application/review-return";

const reviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "RECEIVE"]),
  note: z.string().trim().max(1000).optional(),
});

export type ReturnAdminActionState = { error?: string; success?: string };

export async function reviewReturnRequestAction(
  returnRequestId: string,
  formData: FormData,
): Promise<ReturnAdminActionState> {
  const session = await requireAdminAccess();
  const parsed = reviewSchema.safeParse({
    decision: formData.get("decision"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Decisão inválida." };

  try {
    await reviewReturnRequest({
      returnRequestId,
      decision: parsed.data.decision,
      ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
      actorUserId: session.user.id,
    });
    revalidatePath("/admin", "layout");
    return { success: "Solicitação atualizada." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function refundReturnRequestAction(returnRequestId: string): Promise<ReturnAdminActionState> {
  const session = await requireAdminAccess();

  try {
    const result = await refundReturnRequest({ returnRequestId, actorUserId: session.user.id });
    if (result.outcome === "ALREADY_REFUNDED") return { success: "Esta devolução já foi reembolsada." };
    revalidatePath("/admin", "layout");
    revalidatePath(`/orders/${result.orderNumber}`);
    return { success: "Reembolso processado." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
