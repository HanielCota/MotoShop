"use server";

import { z } from "zod";

import { asApplicationError } from "@/shared/errors/application-error";

import { quoteShippingForActiveCart, type SellerShippingQuotes } from "../application/shipping-quotes";

export type ShippingActionState = { error?: string; quotes?: SellerShippingQuotes[] };

export async function quoteShippingAction(postalCode: string): Promise<ShippingActionState> {
  const parsed = z
    .string()
    .regex(/^\d{8}$/, "Informe um CEP com 8 números.")
    .safeParse(postalCode.replace(/\D/g, ""));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Informe um CEP válido." };

  try {
    return { quotes: await quoteShippingForActiveCart(parsed.data) };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
