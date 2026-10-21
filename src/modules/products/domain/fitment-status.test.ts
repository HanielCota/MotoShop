import { describe, expect, it } from "vitest";

import { resolveFitmentStatus } from "./fitment-status";

const crf = { id: "fitment-crf", label: "Honda CRF 250R · padrão · 2025" };

describe("resolveFitmentStatus", () => {
  it("says a universal product fits the chosen motorcycle without a compatibility list", () => {
    expect(resolveFitmentStatus({ universal: true, compatibleFitmentIds: [], selectedFitment: crf })).toEqual({
      kind: "universal",
      motorcycleLabel: crf.label,
    });
  });

  it("says a universal product fits any motorcycle even before one is chosen", () => {
    expect(resolveFitmentStatus({ universal: true, compatibleFitmentIds: [], selectedFitment: null })).toEqual({
      kind: "universal",
      motorcycleLabel: null,
    });
  });

  it("keeps a universal product universal when the store listed other motorcycles", () => {
    const status = resolveFitmentStatus({ universal: true, compatibleFitmentIds: ["other"], selectedFitment: crf });

    expect(status.kind).toBe("universal");
  });

  it("asks for the motorcycle when the product is not universal and none is chosen", () => {
    expect(resolveFitmentStatus({ universal: false, compatibleFitmentIds: [], selectedFitment: null })).toEqual({
      kind: "no-motorcycle",
    });
  });

  it("treats an empty list as not confirmed, never as incompatible", () => {
    const status = resolveFitmentStatus({ universal: false, compatibleFitmentIds: [], selectedFitment: crf });

    expect(status.kind).toBe("unknown");
  });

  it("separates a confirmed motorcycle from one missing from the list", () => {
    const fits = resolveFitmentStatus({ universal: false, compatibleFitmentIds: [crf.id], selectedFitment: crf });
    const missing = resolveFitmentStatus({ universal: false, compatibleFitmentIds: ["other"], selectedFitment: crf });

    expect(fits.kind).toBe("fits");
    expect(missing.kind).toBe("does-not-fit");
  });
});
