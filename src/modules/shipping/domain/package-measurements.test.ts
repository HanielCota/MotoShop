import { expect, it } from "vitest";
import { getPackageMeasurements } from "./package-measurements";
const product = { widthInMillimeters: 100, heightInMillimeters: 200, lengthInMillimeters: 300, weightInGrams: 500 };
it("uses product measurements only when variant overrides are absent", () => {
  expect(getPackageMeasurements({ ...product, weightInGrams: 1000, heightInMillimeters: null }, product)).toEqual({
    widthInCm: 10,
    heightInCm: 20,
    lengthInCm: 30,
    weightInKg: 1,
  });
});
it("does not invent weight or dimensions for incomplete products", () => {
  expect(getPackageMeasurements({ ...product, weightInGrams: null }, { ...product, weightInGrams: null })).toBeNull();
  expect(getPackageMeasurements({ ...product, weightInGrams: 0 }, product)).toBeNull();
});
