import { z } from "zod";

import type { FieldProblem } from "@/shared/forms/field-error-focus";

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
export function validateDefaultCommissionForm(formData: FormData): FieldProblem | null {
  if (commissionSchema.safeParse(readDefaultCommissionInput(formData)).success) return null;
  return { message: DEFAULT_COMMISSION_ERROR, field: "commissionPercent" };
}
