"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/modules/auth/application/authorization";
import { resolveCustomerOrderIdentity } from "@/modules/orders/application/resolve-customer-order-access";
import { readGuestOrderCookie } from "@/modules/orders/infrastructure/guest-order-cookie";
import { getCustomerOrder } from "@/modules/returns/queries/customer-orders";
import { ApplicationError } from "@/shared/errors/application-error";
import { toActionError } from "@/shared/errors/action-error";
import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";

import { recoverPayment } from "../application/recover-payment";

const refreshPaymentSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
});

export type PaymentActionState = { error?: string; success?: string };

export async function refreshPendingPaymentAction(
  _previousState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const parsed = refreshPaymentSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
  });
  if (!parsed.success) return { error: "Não foi possível validar este pedido." };

  try {
    const session = await getCurrentSession();
    // Same rule as the order page: a valid, unexpired guest link first, then the signed-in owner.
    const identity = await resolveCustomerOrderIdentity({
      orderNumber: parsed.data.orderNumber,
      accessToken: await readGuestOrderCookie(),
      userId: session?.user.id,
    });
    if (!identity) {
      throw new ApplicationError({ code: "UNAUTHORIZED", message: "Acesse o pedido pelo link seguro do checkout." });
    }

    // Each refresh may query the gateway: cap it per order (shared by every viewer of the order).
    await assertRateLimit({
      key: `payment-refresh:${parsed.data.orderNumber.toUpperCase()}`,
      windowSeconds: 60,
      max: 3,
    });
    const order = await getCustomerOrder(parsed.data.orderNumber, identity);
    const payment = order?.payments[0];
    if (!payment) throw new ApplicationError({ code: "NOT_FOUND", message: "Pagamento não encontrado." });
    if (!["PENDING", "PROCESSING", "AUTHORIZED"].includes(payment.status)) {
      return { success: `O pagamento já está ${payment.status.toLowerCase()}.` };
    }
    const recovery = await recoverPayment(payment.id);
    if (recovery.outcome === "UNRESOLVED")
      return { success: "A cobrança ainda não foi localizada. O pedido continua pendente; não faça outro pagamento." };
    if (recovery.outcome === "RELEASED") {
      revalidatePath(`/orders/${parsed.data.orderNumber}`);
      return { success: "Nenhuma cobrança chegou a ser criada. O pedido foi cancelado e você pode comprar novamente." };
    }
    revalidatePath(`/orders/${parsed.data.orderNumber}`);
    return { success: "Status do pagamento atualizado." };
  } catch (error) {
    return { error: toActionError(error, "refreshPendingPaymentAction").message };
  }
}
