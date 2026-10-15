import { z } from "zod";

import { slugify } from "@/lib/utils";

import { splitStoreSlugIssue, type StoreSlugFormProblem } from "./store-slug";

export const sellerOnboardingSchema = z.object({
  storeName: z.string().trim().min(2, "Informe o nome da loja.").max(80),
  storeSlug: z
    .string()
    .trim()
    .min(2, "Informe um identificador para a loja.")
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens."),
  originPostalCode: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "Informe o CEP de origem com 8 números."),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
});

export type SellerOnboardingInput = z.infer<typeof sellerOnboardingSchema>;

/** Lê o cadastro da loja como a action recebe: identificador convertido e CEP só com números. */
export function readSellerOnboardingInput(formData: FormData) {
  return {
    storeName: formData.get("storeName"),
    // Como no perfil da loja: "Luiz Parts" vira "luiz-parts" em vez de ser recusado.
    storeSlug: slugify(String(formData.get("storeSlug") ?? "")),
    originPostalCode: String(formData.get("originPostalCode") ?? "").replace(/\D/g, ""),
    type: formData.get("type"),
  };
}

/** Mesma regra no servidor e no navegador (BUG-011); o erro do identificador vai para o campo. */
export function validateSellerOnboardingForm(formData: FormData): StoreSlugFormProblem | null {
  const parsed = sellerOnboardingSchema.safeParse(readSellerOnboardingInput(formData));
  return parsed.success ? null : splitStoreSlugIssue(parsed.error, "storeSlug");
}
