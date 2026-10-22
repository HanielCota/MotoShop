import { z } from "zod";

import type { FieldProblem } from "@/shared/forms/field-error-focus";

import { readCouponFormInput } from "../domain/coupon-form-input";
import { findCouponValidityError } from "../domain/coupon-validity";

// Coupon amounts and limits are persisted as PostgreSQL int4.
const MAX_INT32 = 2_147_483_647;
const usageLimit = z.coerce
  .number({ error: "Informe o limite de uso como um número inteiro." })
  .int("Informe o limite de uso como um número inteiro.")
  .positive("O limite de uso precisa ser maior que zero.")
  .max(MAX_INT32, "O limite de uso informado é maior que o permitido.");

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,40}$/, "Use de 3 a 40 caracteres: letras, números, _ ou -."),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"], { error: "Escolha o tipo de desconto." }),
  percentageBps: z
    .number({ error: "Informe o percentual com até duas casas, ex.: 10 ou 10,5." })
    .int()
    .min(1, "O percentual precisa ser maior que zero.")
    .max(10_000, "O percentual não pode passar de 100%.")
    .optional(),
  fixedAmountInCents: z
    .number({ error: "Informe o valor em reais, ex.: 25,90." })
    .int()
    .positive("O desconto precisa ser maior que zero.")
    .max(MAX_INT32, "O desconto informado é maior que o permitido.")
    .optional(),
  minimumPurchaseInCents: z
    .number({ error: "Informe a compra mínima em reais, ex.: 150,00." })
    .int()
    .min(0)
    .max(MAX_INT32, "A compra mínima informada é maior que a permitida."),
  globalUsageLimit: usageLimit.optional(),
  perCustomerUsageLimit: usageLimit.optional(),
  showOnProductPage: z.boolean().default(false),
  startsAt: z.date({ error: "Informe o início como dia/mês/ano, ex.: 01/11/2026." }).optional(),
  endsAt: z.date({ error: "Informe o fim como dia/mês/ano, ex.: 30/11/2026." }).optional(),
});

/** Form control (its `name`) for each schema key whose name differs from it. */
const couponFormFields: Partial<Record<string, string>> = {
  percentageBps: "discountPercent",
  fixedAmountInCents: "discountAmount",
  minimumPurchaseInCents: "minimumPurchase",
};

/** O tipo escolhido define qual valor de desconto é obrigatório. */
export function readDiscountAmount(
  data: z.infer<typeof couponSchema>,
): { percentageBps: number } | { fixedAmountInCents: number } | { error: string; field: string } {
  if (data.discountType === "PERCENTAGE") {
    if (data.percentageBps === undefined)
      return { error: "Informe o percentual de desconto.", field: "discountPercent" };
    return { percentageBps: data.percentageBps };
  }

  if (data.fixedAmountInCents === undefined)
    return { error: "Informe o valor do desconto em reais.", field: "discountAmount" };
  return { fixedAmountInCents: data.fixedAmountInCents };
}

export type ParsedCouponForm =
  | {
      ok: true;
      data: z.infer<typeof couponSchema>;
      discountAmount: { percentageBps: number } | { fixedAmountInCents: number };
    }
  | { ok: false; error: string; field: string | undefined };

/** Mesma validação no servidor e no navegador (BUG-011). */
export function parseCouponForm(formData: FormData, now = new Date()): ParsedCouponForm {
  const parsed = couponSchema.safeParse(readCouponFormInput(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const key = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
    return {
      ok: false,
      error: issue?.message ?? "Confira os dados do cupom.",
      field: key ? (couponFormFields[key] ?? key) : undefined,
    };
  }
  const discountAmount = readDiscountAmount(parsed.data);
  if ("error" in discountAmount) return { ok: false, ...discountAmount };

  // Both validity problems are about the end date.
  const validityError = findCouponValidityError(parsed.data, now);
  if (validityError != null) return { ok: false, error: validityError, field: "endsAt" };

  return { ok: true, data: parsed.data, discountAmount };
}

export function validateCouponForm(formData: FormData): FieldProblem | null {
  const parsed = parseCouponForm(formData);
  return parsed.ok ? null : { message: parsed.error, field: parsed.field };
}
