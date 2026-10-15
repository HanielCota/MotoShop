import { z } from "zod";

const MAX_INT32 = 2_147_483_647;

const measurement = z
  .number({ error: "Informe peso e medidas em números inteiros positivos." })
  .int()
  .positive("Peso e medidas devem ser maiores que zero.")
  .max(2_147_483_647)
  .nullable()
  .optional();
const measurements = {
  weightInGrams: measurement,
  heightInMillimeters: measurement,
  widthInMillimeters: measurement,
  lengthInMillimeters: measurement,
};

export const productInputSchema = z.object({
  ...measurements,
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
      z
        .object({
          ...measurements,
          id: z.string().cuid().optional(),
          title: z.string().trim().min(1, "Informe a variação.").max(100),
          sku: z.string().trim().min(1, "Informe o SKU.").max(80),
          priceInCents: z
            .number({ error: "Informe o preço em reais, sem separador de milhar." })
            .int()
            .max(2_147_483_647)
            .positive("O preço deve ser maior que zero."),
          promotionalPriceInCents: z.number().int().positive().max(2_147_483_647).nullable().optional(),
          promotionStartsAt: z.date({ error: "Informe uma data inicial válida." }).nullable().optional(),
          promotionEndsAt: z.date({ error: "Informe uma data final válida." }).nullable().optional(),
          stock: z.coerce
            .number({ error: "Informe o estoque em unidades inteiras." })
            .int("Informe o estoque em unidades inteiras.")
            .nonnegative("O estoque não pode ser negativo.")
            .max(MAX_INT32, "O estoque informado é maior que o permitido."),
        })
        .superRefine((variant, refinementContext) => {
          if (variant.promotionalPriceInCents != null && variant.promotionalPriceInCents >= variant.priceInCents) {
            refinementContext.addIssue({
              code: "custom",
              path: ["promotionalPriceInCents"],
              message: "O preço promocional deve ser menor que o preço normal.",
            });
          }
          if (variant.promotionalPriceInCents == null && (variant.promotionStartsAt || variant.promotionEndsAt)) {
            refinementContext.addIssue({
              code: "custom",
              path: ["promotionalPriceInCents"],
              message: "Informe o preço promocional ou remova as datas da promoção.",
            });
          }
          if (
            variant.promotionStartsAt &&
            variant.promotionEndsAt &&
            variant.promotionEndsAt <= variant.promotionStartsAt
          ) {
            refinementContext.addIssue({
              code: "custom",
              path: ["promotionEndsAt"],
              message: "O término da promoção deve ser posterior ao início.",
            });
          }
        }),
    )
    .min(1, "Adicione pelo menos uma variação.")
    .max(100, "O produto pode ter no máximo 100 variações."),
  motorcycleFitmentIds: z.array(z.string().cuid()).max(100),
});

export type ProductInput = z.infer<typeof productInputSchema>;
