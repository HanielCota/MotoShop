type Measurements = {
  widthInMillimeters: number | null;
  heightInMillimeters: number | null;
  lengthInMillimeters: number | null;
  weightInGrams: number | null;
};

export function getPackageMeasurements(variant: Measurements, product: Measurements) {
  const width = variant.widthInMillimeters ?? product.widthInMillimeters;
  const height = variant.heightInMillimeters ?? product.heightInMillimeters;
  const length = variant.lengthInMillimeters ?? product.lengthInMillimeters;
  const weight = variant.weightInGrams ?? product.weightInGrams;
  if (
    width === null ||
    height === null ||
    length === null ||
    weight === null ||
    ![width, height, length, weight].every((value) => Number.isSafeInteger(value) && value > 0)
  )
    return null;
  return { widthInCm: width / 10, heightInCm: height / 10, lengthInCm: length / 10, weightInKg: weight / 1000 };
}
