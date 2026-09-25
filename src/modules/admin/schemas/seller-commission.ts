import { z } from "zod";
import { parsePriceInputToCents } from "@/modules/products/domain/price-input";

export const sellerCommissionSchema = z.object({
  sellerId: z.string().cuid(),
  commissionBpsOverride: z.number().int().min(0).max(10_000).nullable(),
  previousCommissionBpsOverride: z.number().int().min(0).max(10_000).nullable(),
});

export function parseCommissionPercent(value: FormDataEntryValue | null): number | null {
  return value === "" ? null : parsePriceInputToCents(value ?? undefined);
}
