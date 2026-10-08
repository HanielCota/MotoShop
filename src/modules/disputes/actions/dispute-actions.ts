"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/modules/auth/application/authorization";
import { resolveCustomerOrderIdentity } from "@/modules/orders/application/resolve-customer-order-access";
import { asApplicationError } from "@/shared/errors/application-error";

import { requestDispute } from "../application/request-dispute";

const requestSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  sellerOrderId: z.cuid(),
  reason: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10, "Explique o problema com mais detalhes.").max(2000),
  idempotencyKey: z.uuid(),
  accessToken: z.string().trim().min(1).optional(),
});

export type DisputeActionState = { error?: string; success?: string };

export async function requestDisputeAction(input: unknown): Promise<DisputeActionState> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados da disputa inválidos." };

  try {
    const session = await getCurrentSession();
    if (!session && !parsed.data.accessToken) return { error: "Acesse o pedido pelo link seguro do checkout." };
    const identity = await resolveCustomerOrderIdentity({
      orderNumber: parsed.data.orderNumber,
      accessToken: parsed.data.accessToken,
      userId: session?.user.id,
    });
    if (!identity) return { error: "Pedido não encontrado." };

    await requestDispute({
      orderNumber: parsed.data.orderNumber,
      sellerOrderId: parsed.data.sellerOrderId,
      reason: parsed.data.reason,
      description: parsed.data.description,
      idempotencyKey: parsed.data.idempotencyKey,
      identity,
    });
    revalidatePath(`/orders/${parsed.data.orderNumber}`);
    revalidatePath("/admin", "layout");
    return { success: "Disputa aberta. O Moto Shop fará a mediação." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
