import { z } from "zod";

export const productInputSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome do produto.").max(160),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use um slug válido."),
  description: z.string().trim().min(10, "Descreva o produto com pelo menos 10 caracteres.").max(5_000),
  categoryId: z.string().cuid("Selecione uma categoria."),
  brandId: z.string().cuid("Selecione uma marca."),
  variants: z
    .array(
      z.object({
        id: z.string().cuid().optional(),
        title: z.string().trim().min(1, "Informe a variação.").max(100),
        sku: z.string().trim().min(1, "Informe o SKU.").max(80),
        priceInCents: z.coerce.number().int().positive("O preço deve ser maior que zero."),
        stock: z.coerce.number().int().nonnegative("O estoque não pode ser negativo."),
      }),
    )
    .min(1, "Adicione pelo menos uma variação.")
    .max(100, "O produto pode ter no máximo 100 variações."),
  motorcycleFitmentIds: z.array(z.string().cuid()).max(100),
});

export type ProductInput = z.infer<typeof productInputSchema>;
