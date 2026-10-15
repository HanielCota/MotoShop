"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { getCartIdentity } from "@/modules/cart/infrastructure/cart-access";
import { ApplicationError } from "@/shared/errors/application-error";
import { toActionError } from "@/shared/errors/action-error";
import { consumeRateLimit } from "@/shared/rate-limit/consume-rate-limit";
import { getClientIp } from "@/shared/request/client-ip";

import {
  quoteShippingForActiveCart,
  quoteShippingForVariant,
  type SellerShippingQuotes,
} from "../application/shipping-quotes";

export type ShippingActionState = { error?: string; quotes?: SellerShippingQuotes[] };

const RATE_LIMITED_MESSAGE = "Você fez muitas consultas de frete seguidas. Aguarde um minuto e tente novamente.";

// Shipping quotes are public and may call the seller's Melhor Envio account, so
// every request is limited per visitor (user or guest cart token) and per
// client address. A visitor dropping cookies still hits the address limit.
async function assertShippingQuoteRateLimit(createGuest: boolean) {
  const identity = await getCartIdentity(createGuest);
  const requesterKey = identity
    ? "userId" in identity
      ? `user:${identity.userId}`
      : `guest:${identity.guestAccessTokenHash}`
    : null;
  const clientAddress = getClientIp(await headers());

  const checks = [
    ...(requesterKey ? [{ key: `shipping-quote:${requesterKey}`, windowSeconds: 60, max: 20 }] : []),
    { key: `shipping-quote:ip:${clientAddress}`, windowSeconds: 60, max: 60 },
  ];
  for (const check of checks) {
    const result = await consumeRateLimit(check);
    if (!result.allowed) {
      throw new ApplicationError({ code: "CONFLICT", statusCode: 429, message: RATE_LIMITED_MESSAGE });
    }
  }
}

export async function quoteShippingAction(postalCode: unknown): Promise<ShippingActionState> {
  const parsed = z
    .string()
    .max(32, "Informe um CEP com 8 números.")
    .transform((value) => value.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{8}$/, "Informe um CEP com 8 números."))
    .safeParse(postalCode);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Informe um CEP válido." };

  try {
    await assertShippingQuoteRateLimit(false);
    return { quotes: await quoteShippingForActiveCart(parsed.data) };
  } catch (error) {
    return { error: toActionError(error, "quoteShippingAction").message };
  }
}

export async function quoteProductShippingAction(input: {
  variantId: string;
  postalCode: string;
}): Promise<ShippingActionState> {
  const parsed = z
    .object({
      variantId: z.string().cuid(),
      postalCode: z
        .string()
        .max(32, "Informe um CEP com 8 números.")
        .transform((value) => value.replace(/\D/g, ""))
        .pipe(z.string().regex(/^\d{8}$/, "Informe um CEP com 8 números.")),
    })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira o CEP e a opção escolhida." };
  try {
    await assertShippingQuoteRateLimit(true);
    return { quotes: await quoteShippingForVariant(parsed.data.variantId, parsed.data.postalCode) };
  } catch (error) {
    return { error: toActionError(error, "quoteProductShippingAction").message };
  }
}
