"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { asApplicationError } from "@/shared/errors/application-error";

import { refundPayment, type RefundPaymentResult } from "../application/refund-payment";

const refundInputSchema = z.object({
  orderId: z.cuid(),
  amountInCents: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(1).max(100),
  reason: z.string().trim().max(500).optional(),
});

export type RefundActionState = {
  error?: string;
  result?: RefundPaymentResult;
};

export async function refundPaymentAction(input: unknown): Promise<RefundActionState> {
  await requireAdminAccess();
  const parsed = refundInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados de reembolso inválidos." };

  try {
    const result = await refundPayment({
      orderId: parsed.data.orderId,
      amountInCents: parsed.data.amountInCents,
      idempotencyKey: parsed.data.idempotencyKey,
      ...(parsed.data.reason !== undefined ? { reason: parsed.data.reason } : {}),
    });
    revalidatePath("/admin");
    revalidatePath("/orders");
    return { result };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
