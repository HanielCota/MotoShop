import { z } from "zod";

export const storeProfileSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da loja.").max(120),
  slug: z
    .string()
    .trim()
    .min(3, "Informe um identificador para a loja.")
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens."),
  description: z.string().trim().max(500, "A descrição deve ter no máximo 500 caracteres."),
});

export type StoreProfileInput = z.infer<typeof storeProfileSchema>;
