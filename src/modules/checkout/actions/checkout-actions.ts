"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getCartIdentity } from "@/modules/cart/infrastructure/cart-access";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";

import { executeCheckout, type CheckoutResult } from "../application/checkout-service";
import { checkoutSchema } from "../schemas/checkout";

export type CheckoutActionState = { error?: string; orderNumber?: string; guestAccessToken?: string };

export async function createCheckoutAction(
  _previousState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const parsed = checkoutSchema.safeParse({
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail"),
    customerPhone: formData.get("customerPhone"),
    customerTaxId: formData.get("customerTaxId") || undefined,
    postalCode: String(formData.get("postalCode") ?? "").replace(/\D/g, ""),
    street: formData.get("street"),
    number: formData.get("number"),
    complement: formData.get("complement") || undefined,
    neighborhood: formData.get("neighborhood"),
    city: formData.get("city"),
    state: formData.get("state"),
    paymentMethodId: formData.get("paymentMethodId"),
    checkoutIdempotencyKey: formData.get("checkoutIdempotencyKey"),
    shippingSelections: formData.get("shippingSelections"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do checkout." };

  try {
    const identity = await getCartIdentity();
    if (!identity) throw new ApplicationError({ code: "NOT_FOUND", message: "Seu carrinho expirou." });
    const session = await getCurrentSession();
    const result: CheckoutResult = await executeCheckout({ data: parsed.data, identity, session });
    revalidatePath("/cart");
    revalidatePath("/checkout");
    return result;
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
