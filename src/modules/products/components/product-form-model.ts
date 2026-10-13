import { z } from "zod";

import { slugify } from "@/lib/utils";
import { formatPriceInputFromCents, parsePriceInputToCents } from "@/modules/products/domain/price-input";
import {
  measurementFields,
  parseOptionalInteger,
  parsePromotionDate,
  type Measurements,
} from "@/modules/products/domain/product-commercial-fields";
import { isVariantGender } from "@/modules/products/domain/variant-attributes";
import { productInputSchema } from "@/modules/products/schemas/product-input";

type MeasurementName = (typeof measurementFields)[number]["name"];
type MeasurementValues = Record<MeasurementName, string>;

/**
 * Valores do formulário de produto como o usuário os digita (strings). Os nomes seguem
 * os caminhos de `productInputSchema` para que os erros do Zod caiam no campo certo.
 */
export type VariantFormValues = MeasurementValues & {
  id: string;
  title: string;
  sku: string;
  priceInCents: string;
  stock: string;
  promotionalPriceInCents: string;
  promotionStartsAt: string;
  promotionEndsAt: string;
  gender: string;
  color: string;
  size: string;
};

export type ProductFormValues = MeasurementValues & {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  brandId: string;
  motorcycleFitmentIds: string[];
  variants: VariantFormValues[];
};

/** Formato aceito pelo editor para valores vindos do servidor (centavos e números). */
export type VariantDraft = Measurements & {
  id?: string;
  title: string;
  sku: string;
  priceInCents: number | string;
  stock: number | string;
  promotionalPriceInCents?: number | null;
  promotionStartsAt?: string;
  promotionEndsAt?: string;
  gender?: string | null;
  color?: string | null;
  size?: string | null;
};

function measurementValues(values: Measurements = {}): MeasurementValues {
  return Object.fromEntries(
    measurementFields.map(({ name }) => [name, values[name] == null ? "" : String(values[name])]),
  ) as MeasurementValues;
}

export function toVariantFormValues(variant?: VariantDraft): VariantFormValues {
  return {
    ...measurementValues(variant),
    id: variant?.id ?? "",
    title: variant?.title ?? "",
    sku: variant?.sku ?? "",
    priceInCents:
      typeof variant?.priceInCents === "number"
        ? formatPriceInputFromCents(variant.priceInCents)
        : (variant?.priceInCents ?? ""),
    stock: variant?.stock == null ? "" : String(variant.stock),
    promotionalPriceInCents:
      variant?.promotionalPriceInCents == null ? "" : formatPriceInputFromCents(variant.promotionalPriceInCents),
    promotionStartsAt: variant?.promotionStartsAt ?? "",
    promotionEndsAt: variant?.promotionEndsAt ?? "",
    gender: variant?.gender ?? "",
    color: variant?.color ?? "",
    size: variant?.size ?? "",
  };
}

export function toProductFormValues(
  product: Measurements & {
    name?: string;
    slug?: string;
    description?: string;
    categoryId?: string;
    brandId?: string;
    motorcycleFitmentIds?: string[];
    variants?: VariantDraft[];
  } = {},
): ProductFormValues {
  return {
    ...measurementValues(product),
    name: product.name ?? "",
    slug: product.slug ?? "",
    description: product.description ?? "",
    categoryId: product.categoryId ?? "",
    brandId: product.brandId ?? "",
    motorcycleFitmentIds: product.motorcycleFitmentIds ?? [],
    variants: product.variants?.length ? product.variants.map(toVariantFormValues) : [toVariantFormValues()],
  };
}

function toMeasurementInput(values: MeasurementValues) {
  return Object.fromEntries(measurementFields.map(({ name }) => [name, parseOptionalInteger(values[name])])) as Record<
    MeasurementName,
    number | null
  >;
}

/** Converte strings do formulário para a entrada do schema, com as mesmas regras de `parseProductForm`. */
function toProductInput(values: ProductFormValues): z.input<typeof productInputSchema> {
  return {
    ...toMeasurementInput(values),
    name: values.name,
    slug: slugify(values.slug || values.name),
    description: values.description,
    categoryId: values.categoryId,
    brandId: values.brandId,
    motorcycleFitmentIds: values.motorcycleFitmentIds,
    variants: values.variants.map((variant) => ({
      ...toMeasurementInput(variant),
      id: variant.id || undefined,
      title: variant.title,
      sku: variant.sku,
      priceInCents: parsePriceInputToCents(variant.priceInCents),
      stock: variant.stock,
      promotionalPriceInCents: variant.promotionalPriceInCents
        ? parsePriceInputToCents(variant.promotionalPriceInCents)
        : null,
      promotionStartsAt: parsePromotionDate(variant.promotionStartsAt),
      promotionEndsAt: parsePromotionDate(variant.promotionEndsAt),
      gender: isVariantGender(variant.gender) ? variant.gender : null,
      color: variant.color,
      size: variant.size,
    })),
  };
}

/** Validação client-side: reaproveita `productInputSchema`; o servidor revalida tudo. */
export const productFormSchema = z
  .custom<ProductFormValues>()
  .transform(toProductInput)
  .pipe(productInputSchema)
  .superRefine((input, refinementContext) => {
    const seen = new Set<string>();
    input.variants.forEach((variant, index) => {
      const sku = variant.sku.toLowerCase();
      if (seen.has(sku)) {
        refinementContext.addIssue({
          code: "custom",
          path: ["variants", index, "sku"],
          message: "Cada variação precisa ter um SKU diferente.",
        });
      }
      seen.add(sku);
    });
  });

/** Monta o FormData no contrato da server action (`parseProductForm`). */
export function toProductFormData(values: ProductFormValues, extra: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(extra)) formData.append(key, value);
  for (const { name } of measurementFields) formData.append(name, values[name]);
  formData.append("name", values.name);
  formData.append("slug", values.slug);
  formData.append("description", values.description);
  formData.append("categoryId", values.categoryId);
  formData.append("brandId", values.brandId);
  for (const fitmentId of values.motorcycleFitmentIds) formData.append("motorcycleFitmentIds", fitmentId);
  for (const variant of values.variants) {
    formData.append("variantId", variant.id);
    formData.append("variantTitle", variant.title);
    formData.append("sku", variant.sku);
    formData.append("price", variant.priceInCents);
    formData.append("stock", variant.stock);
    formData.append("promotionalPrice", variant.promotionalPriceInCents);
    formData.append("promotionStartsAt", variant.promotionStartsAt);
    formData.append("promotionEndsAt", variant.promotionEndsAt);
    formData.append("variantGender", variant.gender);
    formData.append("variantColor", variant.color);
    formData.append("variantSize", variant.size);
    for (const { name } of measurementFields) formData.append(`variant_${name}`, variant[name]);
  }
  return formData;
}
