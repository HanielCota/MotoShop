import { z } from "zod";

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
