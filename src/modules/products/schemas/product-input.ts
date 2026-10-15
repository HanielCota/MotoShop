import { z } from "zod";

import { VARIANT_ATTRIBUTE_MAX_LENGTH, variantGenderValues } from "../domain/variant-attributes";

const MAX_INT32 = 2_147_483_647;

const measurement = z
  .number({ error: "Informe peso e medidas em números inteiros positivos." })
  .int("Informe peso e medidas em números inteiros positivos.")
  .positive("Peso e medidas devem ser maiores que zero.")
  .max(2_147_483_647, "Peso ou medida maior que o permitido.")
  .nullable()
  .optional();
const optionalAttributeText = (label: string) =>
  z
    .string()
    .trim()
    .max(VARIANT_ATTRIBUTE_MAX_LENGTH, `Use no máximo ${VARIANT_ATTRIBUTE_MAX_LENGTH} caracteres em ${label}.`)
    .transform((value) => value || null)
    .nullable()
    .optional();
const variantAttributes = {
  gender: z.enum(variantGenderValues, { error: "Escolha um gênero da lista." }).nullable().optional(),
  color: optionalAttributeText("cor"),
  size: optionalAttributeText("tamanho"),
};
const measurements = {
  weightInGrams: measurement,
  heightInMillimeters: measurement,
  widthInMillimeters: measurement,
  lengthInMillimeters: measurement,
};

export const productInputSchema = z.object({
  ...measurements,
  name: z.string().trim().min(3, "Informe o nome do produto.").max(160, "Use no máximo 160 caracteres no nome."),
  slug: z
    .string()
    .trim()
    .min(3, "Use pelo menos 3 letras ou números no slug.")
    .max(160, "Use no máximo 160 caracteres no slug.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use um slug válido."),
  description: z
    .string()
    .trim()
    .min(10, "Descreva o produto com pelo menos 10 caracteres.")
    .max(5_000, "Use no máximo 5.000 caracteres na descrição."),
  categoryId: z.string().cuid("Selecione uma categoria."),
  brandId: z.string().cuid("Selecione uma marca."),
  variants: z
    .array(
      z
        .object({
          ...measurements,
          ...variantAttributes,
          id: z.string().cuid().optional(),
          title: z.string().trim().min(1, "Informe a variação.").max(100, "Use no máximo 100 caracteres na variação."),
          sku: z.string().trim().min(1, "Informe o SKU.").max(80, "Use no máximo 80 caracteres no SKU."),
          priceInCents: z
            .number({ error: "Informe o preço em reais, ex.: 1.234,56." })
            .int("Informe o preço em reais, ex.: 1.234,56.")
            .max(2_147_483_647, "O preço informado é maior que o permitido.")
            .positive("O preço deve ser maior que zero."),
          promotionalPriceInCents: z
            .number({ error: "Informe o preço promocional em reais, ex.: 1.099,90." })
            .int("Informe o preço promocional em reais, ex.: 1.099,90.")
            .positive("O preço promocional deve ser maior que zero.")
            .max(2_147_483_647, "O preço promocional é maior que o permitido.")
            .nullable()
            .optional(),
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
  motorcycleFitmentIds: z
    .array(z.string().cuid("Escolha motos da lista."))
    .max(100, "Escolha no máximo 100 motos compatíveis."),
});

export type ProductInput = z.infer<typeof productInputSchema>;
