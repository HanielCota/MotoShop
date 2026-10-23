import { z } from "zod";

import type { FieldProblem } from "@/shared/forms/field-error-focus";
import { firstIssue } from "@/shared/forms/first-issue-message";

export const sellerInviteSchema = z.object({
  email: z.email("Informe um e-mail válido.").transform((value) => value.trim().toLowerCase()),
  role: z.enum(["ADMIN", "CATALOG", "ORDERS", "FINANCE"], "Escolha o perfil."),
});

export function readSellerInviteForm(formData: FormData) {
  return { email: String(formData.get("email") ?? "").trim(), role: formData.get("role") };
}

/** Mesma regra no navegador e no servidor, sem o balão nativo do e-mail (DN-03). */
export function validateSellerInviteForm(formData: FormData): FieldProblem | null {
  return firstIssue(sellerInviteSchema, readSellerInviteForm(formData), "Confira os dados do convite.");
}
