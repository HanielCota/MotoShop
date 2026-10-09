import { describe, expect, it } from "vitest";

import {
  findFirstFitmentForManufacturer,
  findFirstFitmentForModel,
  formatFitmentVariantLabel,
  getFitmentCascade,
  resolveSelectedFitment,
} from "./fitment-options";

const fitments = [
  { id: "h25", manufacturer: "Honda", model: "CRF 250R", year: 2025, version: "R", displacementCc: 250 },
  { id: "h24", manufacturer: "Honda", model: "CRF 250R", year: 2024, version: "R", displacementCc: 250 },
  { id: "y250", manufacturer: "Yamaha", model: "YZ250F", year: 2025, version: "", displacementCc: 250 },
  { id: "y450", manufacturer: "Yamaha", model: "YZ450F", year: 2025, version: "", displacementCc: 450 },
];

describe("fitment options", () => {
  it("prioritizes URL selection, then primary, then first", () => {
    expect(resolveSelectedFitment(fitments, "y450", "h24")?.id).toBe("y450");
    expect(resolveSelectedFitment(fitments, "unknown", "h24")?.id).toBe("h24");
    expect(resolveSelectedFitment(fitments, null)?.id).toBe("h25");
    expect(resolveSelectedFitment([], "h25")).toBeUndefined();
  });

  it("builds the cascade from one selected fitment", () => {
    expect(getFitmentCascade(fitments, fitments[2])).toEqual({
      manufacturers: ["Honda", "Yamaha"],
      models: ["YZ250F", "YZ450F"],
      variants: [fitments[2]],
    });
    expect(getFitmentCascade([], undefined)).toEqual({ manufacturers: [], models: [], variants: [] });
  });

  it("finds the first fitment on manufacturer/model change", () => {
    expect(findFirstFitmentForManufacturer(fitments, "Yamaha")?.id).toBe("y250");
    expect(findFirstFitmentForModel(fitments, "Yamaha", "YZ450F")?.id).toBe("y450");
  });

  it("formats variant labels without empty parts", () => {
    expect(formatFitmentVariantLabel(defined(fitments[2]))).toBe("2025 · 250 cc");
    expect(formatFitmentVariantLabel(defined(fitments[0]))).toBe("2025 · R · 250 cc");
  });
});

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}
