"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { toActionError } from "@/shared/errors/action-error";
import { isRecordId } from "@/shared/validation/record-id";

import { reviewDispute } from "../application/review-dispute";

const reviewSchema = z
  .object({
    decision: z.enum(["START_REVIEW", "RESOLVE", "REJECT"]),
    note: z.string().trim().max(2000).optional(),
  })
  // Resolver ou recusar encerra a mediação: a decisão precisa de justificativa (BUG-002).
  .refine((input) => input.decision === "START_REVIEW" || Boolean(input.note), {
    message: "Informe a resolução ou o motivo da decisão.",
    path: ["note"],
  });

export type DisputeAdminActionState = { error?: string; success?: string };

const successMessages = {
  OPEN: "Disputa atualizada.",
  UNDER_REVIEW: "Disputa assumida para análise.",
  RESOLVED: "Disputa resolvida.",
  REJECTED: "Disputa recusada.",
} as const;

export async function reviewDisputeAction(disputeId: string, formData: FormData): Promise<DisputeAdminActionState> {
  const session = await requireAdminAccess();
  if (!isRecordId(disputeId)) return { error: "Disputa inválida." };
  const parsed = reviewSchema.safeParse({
    decision: formData.get("decision"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Decisão inválida." };

  try {
    const result = await reviewDispute({
      disputeId,
      decision: parsed.data.decision,
      ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
      actorUserId: session.user.id,
    });
    revalidatePath("/admin", "layout");
    revalidatePath(`/orders/${result.orderNumber}`);
    return { success: successMessages[result.nextStatus] };
  } catch (error) {
    return { error: toActionError(error, "reviewDisputeAction").message };
  }
}
