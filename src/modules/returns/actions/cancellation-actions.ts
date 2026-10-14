"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/modules/auth/application/authorization";
import { resolveCustomerOrderIdentity } from "@/modules/orders/application/resolve-customer-order-access";
import { readGuestOrderCookie } from "@/modules/orders/infrastructure/guest-order-cookie";
import { toActionError } from "@/shared/errors/action-error";

import { requestCancellation } from "../application/request-cancellation";

const requestCancellationSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  sellerOrderId: z.cuid(),
  reason: z.string().trim().min(1).max(100),
  customerMessage: z.string().trim().max(1000).optional(),
  idempotencyKey: z.uuid(),
});

export type CancellationActionState = { error?: string; success?: string };

export async function requestCancellationAction(input: unknown): Promise<CancellationActionState> {
  const parsed = requestCancellationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const session = await getCurrentSession();
    // The guest token comes from the order's HttpOnly cookie, never from the form.
    const accessToken = await readGuestOrderCookie();
    if (!session && !accessToken) return { error: "Acesse o pedido pelo link seguro do checkout." };
    const identity = await resolveCustomerOrderIdentity({
      orderNumber: parsed.data.orderNumber,
      accessToken,
      userId: session?.user.id,
    });
    if (!identity) return { error: "Pedido não encontrado." };
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
    return { error: toActionError(error, "requestCancellationAction").message };
  }
}
