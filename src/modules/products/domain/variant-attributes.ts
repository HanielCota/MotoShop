/** Atributos estruturados da variante, opcionais. Usados no cadastro do lojista e nos filtros da vitrine. */
export const variantGenderValues = ["MALE", "FEMALE", "UNISEX"] as const;
export type VariantGenderValue = (typeof variantGenderValues)[number];

export const variantGenderLabels: Record<VariantGenderValue, string> = {
  MALE: "Masculino",
  FEMALE: "Feminino",
  UNISEX: "Unissex",
};

export const VARIANT_ATTRIBUTE_MAX_LENGTH = 50;

export function isVariantGender(value: unknown): value is VariantGenderValue {
  return typeof value === "string" && (variantGenderValues as readonly string[]).includes(value);
}

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Attributes frozen on the order item: the variant's free-form attributes plus gender, color and size
 * when set. Variants without them keep exactly the snapshot they had before.
 */
export function buildVariantAttributesSnapshot(attributes: unknown, structured: VariantAttributes): unknown {
  const present = Object.entries(getVariantAttributes(structured)).filter(([, value]) => value !== null);
  if (present.length === 0) return attributes;

  return { ...(isPlainObject(attributes) ? attributes : {}), ...Object.fromEntries(present) };
}
