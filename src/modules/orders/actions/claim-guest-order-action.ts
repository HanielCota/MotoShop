"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/modules/auth/application/authorization";
import { claimGuestOrder } from "@/modules/orders/application/claim-guest-order";
import { asApplicationError } from "@/shared/errors/application-error";
import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";

const schema = z.object({
  orderNumber: z.string().trim().min(1).max(64),
  accessToken: z.string().trim().min(20).max(200),
});

export type ClaimGuestOrderState = { error?: string; success?: boolean };

export async function claimGuestOrderAction(
  _previousState: ClaimGuestOrderState,
  formData: FormData,
): Promise<ClaimGuestOrderState> {
  const session = await getCurrentSession();
  if (!session) return { error: "Entre na sua conta para vincular este pedido." };
  const parsed = schema.safeParse({
    orderNumber: formData.get("orderNumber"),
    accessToken: formData.get("accessToken"),
  });
  if (!parsed.success) return { error: "O link do pedido é inválido." };

  try {
    await assertRateLimit({ key: `claim-order:${session.user.id}`, windowSeconds: 60, max: 5 });
    await claimGuestOrder({ ...parsed.data, userId: session.user.id, userEmail: session.user.email });
    revalidatePath("/orders");
    revalidatePath(`/orders/${parsed.data.orderNumber}`);
    return { success: true };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
