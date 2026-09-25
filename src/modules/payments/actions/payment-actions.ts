"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/modules/auth/application/authorization";
import { hashGuestToken } from "@/modules/cart/infrastructure/cart-access";
import { getCustomerOrder } from "@/modules/returns/queries/customer-orders";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";

import { recoverPayment } from "../application/recover-payment";

const refreshPaymentSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  accessToken: z.string().trim().min(1).optional(),
});

export type PaymentActionState = { error?: string; success?: string };

export async function refreshPendingPaymentAction(
  _previousState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const parsed = refreshPaymentSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
    accessToken: formData.get("accessToken") || undefined,
  });
  if (!parsed.success) return { error: "Não foi possível validar este pedido." };

  try {
    const session = await getCurrentSession();
    const identity = parsed.data.accessToken
      ? { guestAccessTokenHash: hashGuestToken(parsed.data.accessToken) }
      : session
        ? { userId: session.user.id }
        : null;
    if (!identity) {
      throw new ApplicationError({ code: "UNAUTHORIZED", message: "Acesse o pedido pelo link seguro do checkout." });
    }

    const order = await getCustomerOrder(parsed.data.orderNumber, identity);
    const payment = order?.payments[0];
    if (!payment) throw new ApplicationError({ code: "NOT_FOUND", message: "Pagamento não encontrado." });
    if (!["PENDING", "PROCESSING", "AUTHORIZED"].includes(payment.status)) {
      return { success: `O pagamento já está ${payment.status.toLowerCase()}.` };
    }
    const recovery = await recoverPayment(payment.id);
    if (recovery.outcome === "UNRESOLVED")
      return { success: "A cobrança ainda não foi localizada. O pedido continua pendente; não faça outro pagamento." };
    revalidatePath(`/orders/${parsed.data.orderNumber}`);
    return { success: "Status do pagamento atualizado." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
