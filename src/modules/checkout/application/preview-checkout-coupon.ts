import "server-only";

import type { CartIdentity } from "@/modules/cart/infrastructure/cart-access";
import type { CouponCustomer } from "@/modules/coupons/domain/coupon-customer-key";
import { ApplicationError } from "@/shared/errors/application-error";

import { calculateCartCouponDiscount } from "../domain/seller-charges";
import { loadCheckoutCoupon } from "./checkout-service";
import { findCheckoutCart } from "./create-pending-order";

/**
 * The discount the coupon would give the current cart, with the same validation and split as the
 * purchase. Nothing is reserved: the purchase checks the coupon again, under a lock.
 */
export async function previewCheckoutCoupon(input: {
  identity: CartIdentity;
  couponCode: string;
  customer: CouponCustomer;
  now: Date;
}): Promise<{ discountInCents: number }> {
  const cart = await findCheckoutCart(input.identity);
  if (cart == null || cart.items.length === 0)
    throw new ApplicationError({ code: "NOT_FOUND", message: "Seu carrinho está vazio." });

  const coupon = await loadCheckoutCoupon(input.couponCode, input.customer, input.now);
  if (coupon == null) throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Digite o código do cupom." });

  return { discountInCents: calculateCartCouponDiscount({ items: cart.items, coupon, now: input.now }) };
}
