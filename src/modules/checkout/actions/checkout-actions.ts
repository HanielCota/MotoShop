"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getCartIdentity } from "@/modules/cart/infrastructure/cart-access";
import { setGuestOrderCookie } from "@/modules/orders/infrastructure/guest-order-cookie";
import { ApplicationError } from "@/shared/errors/application-error";
import { toActionError } from "@/shared/errors/action-error";
import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";

import { executeCheckout, type CheckoutResult } from "../application/checkout-service";
import { checkoutSchema } from "../schemas/checkout";

/**
 * `paymentDeclined: true` comes with `error`: the provider refused the payment, the order
 * was cancelled and the cart restored. The attempt's idempotency key is spent, so the form
 * must discard it (and the card token) before the next submit.
 */
export type CheckoutActionState = {
  error?: string;
  orderNumber?: string;
  paymentDeclined?: true;
};

export async function createCheckoutAction(
  _previousState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const parsed = checkoutSchema.safeParse({
    customerName: formData.get("customerName"),
    couponCode: formData.get("couponCode"),
    customerEmail: formData.get("customerEmail"),
    customerPhone: formData.get("customerPhone"),
    customerTaxId: formData.get("customerTaxId"),
    postalCode: String(formData.get("postalCode") ?? "").replace(/\D/g, ""),
    street: formData.get("street"),
    number: formData.get("number"),
    complement: formData.get("complement") || undefined,
    neighborhood: formData.get("neighborhood"),
    city: formData.get("city"),
    state: formData.get("state"),
    paymentMethodId: formData.get("paymentMethodId"),
    paymentToken: formData.get("paymentToken") || undefined,
    issuerId: formData.get("issuerId") || undefined,
    checkoutIdempotencyKey: formData.get("checkoutIdempotencyKey"),
    shippingSelections: formData.get("shippingSelections"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do checkout." };

  try {
    const identity = await getCartIdentity();
    if (!identity) throw new ApplicationError({ code: "NOT_FOUND", message: "Seu carrinho expirou." });
    await assertRateLimit({
      key: `checkout:${"userId" in identity ? `user:${identity.userId}` : `guest:${identity.guestAccessTokenHash}`}`,
      windowSeconds: 60,
      max: 10,
    });
    const session = await getCurrentSession();
    const result: CheckoutResult = await executeCheckout({ data: parsed.data, identity, session });
    revalidatePath("/cart");
    revalidatePath("/checkout");
    if (result.paymentDeclined)
      return {
        error:
          "O pagamento foi recusado e o pedido foi cancelado. Seu carrinho foi mantido: revise os dados do cartão ou escolha outra forma de pagamento.",
        paymentDeclined: true,
      };
    // The guest token goes to an HttpOnly cookie for this order's page; it never reaches the browser URL.
    if (result.guestAccessToken) await setGuestOrderCookie(result.orderNumber, result.guestAccessToken);
    return { orderNumber: result.orderNumber };
  } catch (error) {
    return { error: toActionError(error, "createCheckoutAction").message };
  }
}
