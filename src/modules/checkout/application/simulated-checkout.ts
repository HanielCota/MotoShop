import "server-only";

import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { ApplicationError } from "@/shared/errors/application-error";

import { buildSimulatedPurchase, type SimulatedPurchase } from "../domain/simulated-purchase";
import { priceCheckoutCart, type CheckoutRequest } from "./checkout-service";
import type { CheckoutCart } from "./create-pending-order";

const PURCHASABLE_SELLER_STATUSES = new Set(["APPROVED", "ACTIVE"]);

/** Test products (`isDemo`) only: a cart with any real product follows the real checkout. */
export function isTestOnlyCart(cart: CheckoutCart): boolean {
  return cart.items.length > 0 && cart.items.every((item) => item.variant.product.isDemo);
}

/**
 * Simulated purchase of test products (margot#351). It validates and prices exactly like a real
 * checkout (data, shipping, coupon, stock), then answers with the summary. Nothing about a
 * purchase is written: no order, stock reservation, coupon redemption, payment, e-mail, job or
 * payment provider call. The only write is emptying the customer's own cart, as a purchase would.
 */
export async function simulateTestCheckout(
  input: CheckoutRequest,
  cart: CheckoutCart,
  now: Date,
): Promise<SimulatedPurchase> {
  // No card for now: the card fields would already call Mercado Pago (decision of 16/10/2026).
  if (input.data.paymentMethodId !== "pix")
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Escolha o Pix para concluir a compra." });
  assertItemsStillPurchasable(cart);

  const { sellerCharges } = await priceCheckoutCart(input, cart, now);
  const purchase = buildSimulatedPurchase(input.data, sellerCharges);

  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  logger.info({ event: "checkout.simulated_purchase", cartId: cart.id, sellerCount: sellerCharges.length });
  return purchase;
}

function assertItemsStillPurchasable(cart: CheckoutCart) {
  for (const item of cart.items) {
    const { product } = item.variant;
    const available =
      item.variant.active && product.status === "APPROVED" && PURCHASABLE_SELLER_STATUSES.has(product.seller.status);
    if (!available)
      throw new ApplicationError({
        code: "CONFLICT",
        message: `${product.name} não está mais disponível. Atualize o carrinho para continuar.`,
      });
    if ((item.variant.inventory?.availableQuantity ?? 0) < item.quantity)
      throw new ApplicationError({
        code: "OUT_OF_STOCK",
        message: `Não há estoque suficiente de ${product.name}. Atualize o carrinho para continuar.`,
      });
  }
}
