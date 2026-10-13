/** Atributos estruturados da variante, opcionais. Usados no cadastro do lojista e nos filtros da vitrine. */
export const variantGenderValues = ["MALE", "FEMALE", "UNISEX"] as const;
export type VariantGenderValue = (typeof variantGenderValues)[number];

export const variantGenderLabels: Record<VariantGenderValue, string> = {
  MALE: "Masculino",
  FEMALE: "Feminino",
  UNISEX: "Unissex",
};

export const VARIANT_ATTRIBUTE_MAX_LENGTH = 50;

export type VariantAttributes = {
  gender?: VariantGenderValue | null | undefined;
  color?: string | null | undefined;
  size?: string | null | undefined;
};

export function getVariantAttributes(value: VariantAttributes) {
  return {
    gender: value.gender ?? null,
    color: value.color ?? null,
    size: value.size ?? null,
  };
}
