"use server";

import { z } from "zod";

import { asApplicationError } from "@/shared/errors/application-error";

import {
  quoteShippingForActiveCart,
  quoteShippingForVariant,
  type SellerShippingQuotes,
} from "../application/shipping-quotes";

export type ShippingActionState = { error?: string; quotes?: SellerShippingQuotes[] };

export async function quoteShippingAction(postalCode: unknown): Promise<ShippingActionState> {
  const parsed = z
    .string()
    .max(32, "Informe um CEP com 8 números.")
    .transform((value) => value.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{8}$/, "Informe um CEP com 8 números."))
    .safeParse(postalCode);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Informe um CEP válido." };

  try {
    return { quotes: await quoteShippingForActiveCart(parsed.data) };
  } catch (error) {
    return { error: asApplicationError(error).message };
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
        .transform((value) => value.replace(/\D/g, ""))
        .pipe(z.string().regex(/^\d{8}$/, "Informe um CEP com 8 números.")),
    })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira o CEP e a opção escolhida." };
  try {
    return { quotes: await quoteShippingForVariant(parsed.data.variantId, parsed.data.postalCode) };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
