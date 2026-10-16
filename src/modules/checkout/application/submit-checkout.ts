import "server-only";

import { mercadoPagoProvider } from "@/lib/payment/mercado-pago-provider";
import type { PaymentProvider } from "@/shared/payment/payment-provider";

import type { SimulatedPurchase } from "../domain/simulated-purchase";
import { executeCheckout, type CheckoutRequest, type CheckoutResult } from "./checkout-service";
import { findCheckoutCart } from "./create-pending-order";
import { isTestOnlyCart, simulateTestCheckout } from "./simulated-checkout";

export type CheckoutSubmission =
  { kind: "order"; result: CheckoutResult } | { kind: "simulated"; purchase: SimulatedPurchase };

/**
 * A cart of test products gets the simulated purchase; anything else goes to the real checkout,
 * which keeps its own idempotency and refuses test products on its own.
 */
export async function submitCheckout(
  input: CheckoutRequest,
  paymentProvider: PaymentProvider = mercadoPagoProvider,
): Promise<CheckoutSubmission> {
  const cart = await findCheckoutCart(input.identity);
  if (cart && isTestOnlyCart(cart))
    return { kind: "simulated", purchase: await simulateTestCheckout(input, cart, new Date()) };

  return { kind: "order", result: await executeCheckout(input, paymentProvider) };
}
