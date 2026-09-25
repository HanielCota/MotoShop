export const measurementFields = [
  { name: "weightInGrams", label: "Peso embalado (g)" },
  { name: "heightInMillimeters", label: "Altura da embalagem (mm)" },
  { name: "widthInMillimeters", label: "Largura da embalagem (mm)" },
  { name: "lengthInMillimeters", label: "Comprimento da embalagem (mm)" },
] as const;

export type Measurements = Partial<Record<(typeof measurementFields)[number]["name"], number | null | undefined>>;

export function parseOptionalInteger(value: FormDataEntryValue | null | undefined) {
  if (value == null || value === "") return null;
  return typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : Number.NaN;
}

// The form explicitly uses UTC-03:00, independent of server/browser timezone.
export function parsePromotionDate(value: FormDataEntryValue | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return new Date(NaN);
  const date = new Date(`${value}:00-03:00`);
  if (!Number.isFinite(date.getTime()) || formatPromotionDate(date) !== value) return new Date(NaN);
  return date;
}

export function formatPromotionDate(date: Date | null | undefined): string {
  return date ? new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16) : "";
}

export function getMeasurements(value: Measurements) {
  return {
    weightInGrams: value.weightInGrams ?? null,
    heightInMillimeters: value.heightInMillimeters ?? null,
    widthInMillimeters: value.widthInMillimeters ?? null,
    lengthInMillimeters: value.lengthInMillimeters ?? null,
  };
}

export function getVariantCommercialFields(
  value: Measurements & {
    promotionalPriceInCents?: number | null | undefined;
    promotionStartsAt?: Date | null | undefined;
    promotionEndsAt?: Date | null | undefined;
  },
) {
  return {
    ...getMeasurements(value),
    promotionalPriceInCents: value.promotionalPriceInCents ?? null,
    promotionStartsAt: value.promotionStartsAt ?? null,
    promotionEndsAt: value.promotionEndsAt ?? null,
  };
}

export function commercialAuditSnapshot(
  value: Measurements & {
    variants: (Parameters<typeof getVariantCommercialFields>[0] & {
      id?: string | undefined;
      sku: string;
      priceInCents: number;
    })[];
  },
) {
  return {
    ...getMeasurements(value),
    variants: value.variants.map((variant) => ({
      ...getVariantCommercialFields(variant),
      id: variant.id ?? null,
      sku: variant.sku,
      priceInCents: variant.priceInCents,
      promotionStartsAt: variant.promotionStartsAt?.toISOString() ?? null,
      promotionEndsAt: variant.promotionEndsAt?.toISOString() ?? null,
    })),
  };
}
