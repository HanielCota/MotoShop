import "server-only";

import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { mercadoPagoProvider } from "@/lib/payment/mercado-pago-provider";
import { ApplicationError } from "@/shared/errors/application-error";
import type { PaymentProvider } from "@/shared/payment/payment-provider";

/** Fails before any order is created when the real gateway is not fully configured. */
export function assertPaymentConfigured(paymentProvider: PaymentProvider, paymentMethodId: string): void {
  if (paymentProvider !== mercadoPagoProvider) return;
  if (
    (paymentMethodId !== "pix" && !env.MERCADO_PAGO_PUBLIC_KEY) ||
    (env.MERCADO_PAGO_NOTIFICATION_URL && !env.MERCADO_PAGO_WEBHOOK_SECRET)
  ) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "A configuração de pagamento ainda precisa ser concluída pelo Moto Shop.",
    });
  }
  if (!env.MERCADO_PAGO_ACCESS_TOKEN)
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "O pagamento ainda não está disponível. Nenhuma cobrança foi criada.",
    });
}

/**
 * Read-only view of the same checks the checkout service enforces, so pages can tell the customer
 * up front instead of after they type personal data. The service still re-validates on submit.
 */
export function getCheckoutPaymentAvailability(
  sellerCount: number,
  paymentProvider: PaymentProvider = mercadoPagoProvider,
): { available: boolean; cardPublicKey: string | undefined } {
  try {
    assertPaymentConfigured(paymentProvider, "pix");
    assertPaymentCanHandleSellers(sellerCount, paymentProvider);
  } catch (error) {
    // Missing configuration and unsupported seller counts are expected states; anything else is a bug
    // that would otherwise look like "payment unavailable" with no trace.
    if (!(error instanceof ApplicationError)) {
      logger.error({ event: "checkout.payment_availability.failed", sellerCount, error });
    }

    return { available: false, cardPublicKey: undefined };
  }
  // The Public Key is meant for the browser (Secure Fields); the Access Token never leaves the server.
  return { available: true, cardPublicKey: env.MERCADO_PAGO_PUBLIC_KEY };
}

export function assertPaymentCanHandleSellers(sellerCount: number, provider: PaymentProvider): void {
  if (!provider.supportsSellerCount(sellerCount)) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message:
        sellerCount > 1
          ? "O checkout com vários lojistas depende da habilitação do split 1:N no Mercado Pago."
          : "O lojista ainda não conectou uma conta Mercado Pago ao marketplace. Nenhum pedido ou cobrança foi criado.",
      statusCode: 503,
    });
  }
}
