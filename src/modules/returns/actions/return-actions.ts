"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/modules/auth/application/authorization";
import { hashGuestToken } from "@/modules/cart/infrastructure/cart-access";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";

import { requestReturn, type ReturnRequestResult } from "../application/request-return";

const requestReturnSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  orderItemId: z.cuid(),
  quantity: z.number().int().positive(),
  reason: z.enum(["DAMAGED", "WRONG_ITEM", "NOT_AS_DESCRIBED", "REGRET", "OTHER"]),
  customerMessage: z.string().trim().max(1000).optional(),
  idempotencyKey: z.uuid(),
  accessToken: z.string().trim().min(1).optional(),
});

export type ReturnActionState = {
  error?: string;
  success?: string;
  result?: ReturnRequestResult;
};

export async function requestReturnAction(input: unknown): Promise<ReturnActionState> {
  const parsed = requestReturnSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados da devolução inválidos." };

  try {
    const session = await getCurrentSession();
    const identity = session
      ? { userId: session.user.id }
      : parsed.data.accessToken
        ? { guestAccessTokenHash: hashGuestToken(parsed.data.accessToken) }
        : null;
    if (!identity) {
      throw new ApplicationError({ code: "UNAUTHORIZED", message: "Acesse o pedido pelo link seguro do checkout." });
    }

    const result = await requestReturn({
      orderNumber: parsed.data.orderNumber,
      orderItemId: parsed.data.orderItemId,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.idempotencyKey,
      ...(parsed.data.customerMessage !== undefined ? { customerMessage: parsed.data.customerMessage } : {}),
      identity,
    });
    revalidatePath(`/orders/${parsed.data.orderNumber}`);
    return { success: "Solicitação de devolução registrada.", result };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
