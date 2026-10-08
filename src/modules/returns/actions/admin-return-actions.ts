"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { ApplicationError } from "@/shared/errors/application-error";

import { refundReturnRequest } from "../application/refund-return";
import { reviewReturnRequest } from "../application/review-return";

const reviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "RECEIVE"]),
  note: z.string().trim().max(1000).optional(),
});

export type ReturnAdminActionState = { error?: string; success?: string };

/**
 * Erros de domínio têm mensagem própria. Falhas inesperadas (provedor de pagamento indisponível,
 * timeout, rede) não podem chegar ao Admin como texto genérico em inglês: registra o erro e
 * informa que a solicitação continua no mesmo estado e pode ser reprocessada.
 */
function toActionError(error: unknown, returnRequestId: string): { error: string } {
  if (error instanceof ApplicationError && error.code !== "INTERNAL_ERROR") return { error: error.message };
  logger.error({
    event: "return.admin_action_failed",
    returnRequestId,
    error: error instanceof Error ? error.message : "unknown",
  });
  return {
    error: "Não foi possível concluir agora. A devolução permanece pendente e pode ser reprocessada em instantes.",
  };
}

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
    return toActionError(error, returnRequestId);
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
    return toActionError(error, returnRequestId);
  }
}
