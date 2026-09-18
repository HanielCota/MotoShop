"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/modules/auth/application/authorization";
import { hashGuestToken } from "@/modules/cart/infrastructure/cart-access";
import { asApplicationError } from "@/shared/errors/application-error";

import { requestCancellation } from "../application/request-cancellation";

const requestCancellationSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  sellerOrderId: z.cuid(),
  reason: z.string().trim().min(1).max(100),
  customerMessage: z.string().trim().max(1000).optional(),
  idempotencyKey: z.uuid(),
  accessToken: z.string().trim().min(1).optional(),
});

export type CancellationActionState = { error?: string; success?: string };

export async function requestCancellationAction(input: unknown): Promise<CancellationActionState> {
  const parsed = requestCancellationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const session = await getCurrentSession();
    const identity = session
      ? { userId: session.user.id }
      : parsed.data.accessToken
        ? { guestAccessTokenHash: hashGuestToken(parsed.data.accessToken) }
        : null;
    if (!identity) return { error: "Acesse o pedido pelo link seguro do checkout." };
    await requestCancellation({
      orderNumber: parsed.data.orderNumber,
      sellerOrderId: parsed.data.sellerOrderId,
      reason: parsed.data.reason,
      ...(parsed.data.customerMessage !== undefined ? { customerMessage: parsed.data.customerMessage } : {}),
      idempotencyKey: parsed.data.idempotencyKey,
      identity,
    });
    revalidatePath(`/orders/${parsed.data.orderNumber}`);
    return { success: "Solicitação de cancelamento enviada para análise." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
