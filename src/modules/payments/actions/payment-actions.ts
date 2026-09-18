"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/modules/auth/application/authorization";
import { hashGuestToken } from "@/modules/cart/infrastructure/cart-access";
import { getCustomerOrder } from "@/modules/returns/queries/customer-orders";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";
import { mercadoPagoProvider } from "@/lib/payment/mercado-pago-provider";

import { reconcileMercadoPagoPayment } from "../application/reconcile-payment";

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
    const identity = session
      ? { userId: session.user.id }
      : parsed.data.accessToken
        ? { guestAccessTokenHash: hashGuestToken(parsed.data.accessToken) }
        : null;
    if (!identity) {
      throw new ApplicationError({ code: "UNAUTHORIZED", message: "Acesse o pedido pelo link seguro do checkout." });
    }

    const order = await getCustomerOrder(parsed.data.orderNumber, identity);
    const payment = order?.payments[0];
    if (!payment) throw new ApplicationError({ code: "NOT_FOUND", message: "Pagamento não encontrado." });
    if (!["PENDING", "PROCESSING"].includes(payment.status)) {
      return { success: `O pagamento já está ${payment.status.toLowerCase()}.` };
    }
    if (!payment.externalId) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O pagamento ainda não possui identificador externo. Aguarde o processamento automático.",
      });
    }

    const providerResult = await mercadoPagoProvider.getPayment(payment.externalId);
    await reconcileMercadoPagoPayment({ externalId: payment.externalId, result: providerResult });
    revalidatePath(`/orders/${parsed.data.orderNumber}`);
    return { success: "Status do pagamento atualizado." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
