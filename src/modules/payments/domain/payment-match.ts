import { ApplicationError } from "@/shared/errors/application-error";
import type { GetPaymentResult } from "@/shared/payment/payment-provider";

export function assertPaymentMatches(
  payment: {
    externalId: string | null;
    amountInCents: number;
    currency: string;
    method: string | null;
    order: { orderNumber: string };
  },
  result: GetPaymentResult,
) {
  const metadata = result.providerMetadata;
  const amount = metadata.transaction_amount;
  if (
    !result.externalId ||
    (payment.externalId !== null && result.externalId !== payment.externalId) ||
    metadata.external_reference !== payment.order.orderNumber ||
    metadata.currency_id !== payment.currency ||
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    Math.abs(amount * 100 - payment.amountInCents) > 0.000001 ||
    (payment.method !== null && metadata.payment_method_id !== payment.method)
  ) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Os dados da cobrança precisam de revisão pelo Moto Shop. Nenhuma reserva foi alterada.",
    });
  }
}
