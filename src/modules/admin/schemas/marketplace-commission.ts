import { z } from "zod";

import { parseCommissionPercent } from "./seller-commission";

export const DEFAULT_COMMISSION_ERROR = "Informe uma comissão entre 0% e 100%.";

// O formulário recebe percentual ("12,50"); o banco guarda basis points (1250).
export const commissionSchema = z.object({
  defaultCommissionBps: z.number().int().min(0).max(10_000),
});

export function readDefaultCommissionInput(formData: FormData) {
  return { defaultCommissionBps: parseCommissionPercent(formData.get("commissionPercent")) };
}

/** Mesma regra no servidor e no navegador (BUG-011). */
export function validateDefaultCommissionForm(formData: FormData): string | null {
  return commissionSchema.safeParse(readDefaultCommissionInput(formData)).success ? null : DEFAULT_COMMISSION_ERROR;
}
