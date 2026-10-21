export type FitmentStatus =
  | { kind: "fits"; motorcycleLabel: string }
  | { kind: "does-not-fit"; motorcycleLabel: string }
  | { kind: "unknown"; motorcycleLabel: string }
  | { kind: "universal"; motorcycleLabel: string | null }
  | { kind: "no-motorcycle" };

type FitmentStatusInput = {
  /** The product's category, or one above it, is universal. */
  universal: boolean;
  compatibleFitmentIds: string[];
  selectedFitment: { id: string; label: string } | null;
};

/**
 * What the "Sua moto" box near the price says. A universal product fits any motorcycle, with or
 * without one chosen. Otherwise an empty compatibility list means "not confirmed", never "does not fit".
 */
export function resolveFitmentStatus({
  universal,
  compatibleFitmentIds,
  selectedFitment,
}: FitmentStatusInput): FitmentStatus {
  if (universal) return { kind: "universal", motorcycleLabel: selectedFitment?.label ?? null };
  if (selectedFitment == null) return { kind: "no-motorcycle" };

  const motorcycleLabel = selectedFitment.label;
  if (compatibleFitmentIds.length === 0) return { kind: "unknown", motorcycleLabel };
  if (compatibleFitmentIds.includes(selectedFitment.id)) return { kind: "fits", motorcycleLabel };

  return { kind: "does-not-fit", motorcycleLabel };
}
