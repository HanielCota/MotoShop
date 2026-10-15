/**
 * Fills the structured variant columns (gender, color, size) of the review demo from the
 * free-form `attributes` the seed already writes ({ cor, tamanho, ... }). Pure: no database.
 */
export type VariantGender = "MALE" | "FEMALE" | "UNISEX";

export type VariantColumns = { gender: VariantGender; color: string | null; size: string | null };

const MAX_LENGTH = 50;

function readText(attributes: unknown, key: string): string | null {
  if (typeof attributes !== "object" || attributes === null) return null;

  const value = (attributes as Record<string, unknown>)[key];
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, MAX_LENGTH) : null;
}

/** MALE/FEMALE only when the product name says so; anything else is UNISEX. */
export function inferVariantGender(productName: string): VariantGender {
  const name = productName.toLocaleLowerCase("pt-BR");
  if (/\bfeminin[ao]s?\b/.test(name)) return "FEMALE";
  if (/\bmasculin[ao]s?\b/.test(name)) return "MALE";
  return "UNISEX";
}

/**
 * Columns for a variant that has a color or a size; `null` for parts without them (oil, chain,
 * brake pad...), which keep the three columns empty instead of a meaningless gender.
 */
export function inferVariantColumns(input: { productName: string; attributes: unknown }): VariantColumns | null {
  const color = readText(input.attributes, "cor");
  const size = readText(input.attributes, "tamanho");
  if (!color && !size) return null;

  return { gender: inferVariantGender(input.productName), color, size };
}
