import "server-only";

import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { mercadoPagoProvider } from "@/lib/payment/mercado-pago-provider";
import { ApplicationError } from "@/shared/errors/application-error";
import type { PaymentRecoveryProvider } from "@/shared/payment/payment-provider";
import { reconcileMercadoPagoPayment } from "./reconcile-payment";
import { releaseUnsentPayment } from "./release-unsent-payment";
import { assertPaymentMatches } from "../domain/payment-match";
import { isLongUnresolvedPayment } from "../domain/unresolved-payment";

// Internal use case: callers must authorize the order or run in a trusted workflow.
// Never creates a charge, including when search is empty or the gateway times out.
// The only local release without a provider answer is a charge that provably never reached
// the provider (never sent, or definitively rejected): see domain/payment-request-state.ts.
export async function recoverPayment(paymentId: string, provider: PaymentRecoveryProvider = mercadoPagoProvider) {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment || payment.provider !== "MERCADO_PAGO") {
    throw new ApplicationError({ code: "NOT_FOUND", message: "Pagamento não encontrado." });
  }
  if (!payment.externalId && payment.status === "PENDING" && payment.order.status === "PENDING_PAYMENT") {
    const release = await releaseUnsentPayment(payment.id);
    if (release.released) return { outcome: "RELEASED" as const };
    // The checkout has not sent the request yet (grace period): there is nothing to search for.
    if (release.decision === "WAIT") return { outcome: "UNRESOLVED" as const };
  }
  const result = payment.externalId
    ? await provider.getPayment(payment.externalId)
    : await provider.findPaymentByOrderNumber(payment.order.orderNumber);
  // An empty search is not proof of a failed charge (eventual consistency).
  if (!result) {
    warnWhenLongUnresolved(payment);
    return { outcome: "UNRESOLVED" as const };
  }
  assertPaymentMatches(payment, result);
  const reconciled = await reconcileMercadoPagoPayment({
    externalId: result.externalId,
    result,
    expectedPaymentId: payment.id,
  });
  return { outcome: "RECONCILED" as const, ...reconciled };
}

/**
 * L-09: a charge marked SENT that the provider never shows stays pending (and holds stock)
 * forever, because only a provider answer may release it. Past the threshold this logs a
 * warning so the case reaches monitoring; the Admin can list them with
 * `listLongUnresolvedPayments`.
 */
function warnWhenLongUnresolved(payment: { id: string; externalId: string | null; createdAt: Date }): void {
  if (!isLongUnresolvedPayment(payment, new Date())) return;

  logger.warn({ event: "payment.unresolved_at_provider", paymentId: payment.id, createdAt: payment.createdAt });
}
