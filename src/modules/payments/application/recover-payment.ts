import "server-only";

import { db } from "@/lib/database";
import { mercadoPagoProvider } from "@/lib/payment/mercado-pago-provider";
import { ApplicationError } from "@/shared/errors/application-error";
import type { PaymentRecoveryProvider } from "@/shared/payment/payment-provider";
import { reconcileMercadoPagoPayment } from "./reconcile-payment";

// Internal use case: callers must authorize the order or run in a trusted workflow.
// Never creates a charge, including when search is empty or the gateway times out.
export async function recoverPayment(paymentId: string, provider: PaymentRecoveryProvider = mercadoPagoProvider) {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment || payment.provider !== "MERCADO_PAGO") {
    throw new ApplicationError({ code: "NOT_FOUND", message: "Pagamento não encontrado." });
  }
  const result = payment.externalId
    ? await provider.getPayment(payment.externalId)
    : await provider.findPaymentByOrderNumber(payment.order.orderNumber);
  // An empty search is not proof of a failed charge (eventual consistency).
  if (!result) return { outcome: "UNRESOLVED" as const };
  const metadata = result.providerMetadata;
  const amount = metadata.transaction_amount;
  if (
    (payment.externalId && result.externalId !== payment.externalId) ||
    metadata.external_reference !== payment.order.orderNumber ||
    metadata.currency_id !== payment.currency ||
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    Math.abs(amount * 100 - payment.amountInCents) > 0.000001 ||
    (payment.method && metadata.payment_method_id !== payment.method)
  ) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Os dados da cobrança precisam de revisão pela Moto Shop. Nenhuma reserva foi alterada.",
    });
  }
  const reconciled = await reconcileMercadoPagoPayment({
    externalId: result.externalId,
    result,
    expectedPaymentId: payment.id,
  });
  return { outcome: "RECONCILED" as const, ...reconciled };
}
