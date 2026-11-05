import { z } from "zod";

import {
  isMarketplaceLimitInRange,
  MARKETPLACE_LIMIT_BOUNDS,
  marketplaceLimitFields,
  type MarketplaceLimitField,
  type StoredMarketplaceLimits,
} from "../domain/marketplace-limits";

/** Labels of the Limites card, also used in the validation messages and the audit log (`audit-log-presentation.ts`). */
export const marketplaceLimitLabels = {
  productPhotoLimit: "Fotos por produto",
  photoMaxSizeInMegabytes: "Tamanho máximo de cada foto (MB)",
  returnPhotoLimit: "Fotos por pedido de devolução",
  lastUnitsThreshold: "“Últimas unidades” na loja a partir de",
  lowStockThreshold: "“Estoque baixo” na Central do Lojista a partir de",
  newProductDays: "Dias com o selo “Novidade”",
  sellerInviteTtlDays: "Validade do convite da equipe (dias)",
} as const satisfies Record<MarketplaceLimitField, string>;

// Longest valid value is two digits; this only stops oversized input before parsing.
const MAX_LIMIT_INPUT_LENGTH = 10;
const DIGITS_ONLY = /^\d+$/;

function rangeMessage(field: MarketplaceLimitField): string {
  const bounds = MARKETPLACE_LIMIT_BOUNDS[field];
  return `Em “${marketplaceLimitLabels[field]}”, use um número inteiro de ${bounds.min} a ${bounds.max}, ou deixe em branco.`;
}

function optionalLimit(field: MarketplaceLimitField) {
  const message = rangeMessage(field);

  return z
    .string({ error: message })
    .max(MAX_LIMIT_INPUT_LENGTH, message)
    .transform((value) => value.trim())
    .refine((value) => value === "" || DIGITS_ONLY.test(value), message)
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value == null || isMarketplaceLimitInRange(field, value), message);
}

/**
 * Admin › Configurações › Limites. Every field is optional: blank means "use the value of today".
 */
export const marketplaceLimitsSchema = z.object({
  productPhotoLimit: optionalLimit("productPhotoLimit"),
  photoMaxSizeInMegabytes: optionalLimit("photoMaxSizeInMegabytes"),
  returnPhotoLimit: optionalLimit("returnPhotoLimit"),
  lastUnitsThreshold: optionalLimit("lastUnitsThreshold"),
  lowStockThreshold: optionalLimit("lowStockThreshold"),
  newProductDays: optionalLimit("newProductDays"),
  sellerInviteTtlDays: optionalLimit("sellerInviteTtlDays"),
}) satisfies z.ZodType<StoredMarketplaceLimits, MarketplaceLimitsFormInput>;

/** What the form fields hold: plain strings, empty when the limit uses the code default. */
export type MarketplaceLimitsFormInput = Record<MarketplaceLimitField, string>;

/** Form values for the stored limits; blank stays blank so the default shows as the placeholder. */
export function marketplaceLimitsFormValues(stored: StoredMarketplaceLimits | null): MarketplaceLimitsFormInput {
  const entries = marketplaceLimitFields.map((field) => {
    const value = stored?.[field];
    return [field, value == null ? "" : String(value)] as const;
  });
  return Object.fromEntries(entries) as MarketplaceLimitsFormInput;
}
