import { describe, expect, it } from "vitest";

import { parseProductForm } from "@/modules/products/schemas/parse-product-form";

import { productFormSchema, toProductFormData, toProductFormValues } from "./product-form-model";

const categoryId = "ckcategory0000000000000001";
const brandId = "ckbrand00000000000000000001";

function validValues() {
  return toProductFormValues({
    name: "Capacete Fox V1",
    slug: "",
    description: "Capacete off-road leve e ventilado.",
    categoryId,
    brandId,
    weightInGrams: 1500,
    variants: [{ title: "Preto / M", sku: "FOX-V1-M", priceInCents: 149990, stock: 3 }],
  });
}

describe("product form model", () => {
  it("keeps the server action FormData contract (parseProductForm)", () => {
    const formData = toProductFormData(validValues(), { revision: "2026-10-07T00:00:00.000Z" });
    const parsed = parseProductForm(formData);

    expect(formData.get("revision")).toBe("2026-10-07T00:00:00.000Z");
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      slug: "capacete-fox-v1",
      weightInGrams: 1500,
      variants: [
        { title: "Preto / M", sku: "FOX-V1-M", priceInCents: 149990, stock: 3, promotionalPriceInCents: null },
      ],
    });
  });

  it("sends gender, color and size through the same FormData contract", () => {
    const values = toProductFormValues({
      name: "Camisa de motocross",
      slug: "",
      description: "Camisa leve para trilha e motocross.",
      categoryId,
      brandId,
      variants: [
        {
          title: "M / Preto",
          sku: "CAMISA-M",
          priceInCents: 19990,
          stock: 2,
          gender: "UNISEX",
          color: "Preto",
          size: "M",
        },
        { title: "G", sku: "CAMISA-G", priceInCents: 19990, stock: 1 },
      ],
    });

    expect(productFormSchema.safeParse(values).success).toBe(true);
    expect(parseProductForm(toProductFormData(values)).data?.variants).toMatchObject([
      { gender: "UNISEX", color: "Preto", size: "M" },
      { gender: null, color: null, size: null },
    ]);
  });

  it("reports schema errors on the matching form field paths", () => {
    const values = validValues();
    values.description = "curta";
    defined(values.variants[0]).priceInCents = "abc";
    defined(values.variants[0]).promotionalPriceInCents = "2000,00";
    const result = productFormSchema.safeParse(values);

    expect(result.success).toBe(false);
    const paths = defined(result.error).issues.map((issue) => issue.path.join("."));
    expect(paths).toContain("description");
    expect(paths).toContain("variants.0.priceInCents");
  });

  it("flags duplicated SKUs on the second variant", () => {
    const values = validValues();
    values.variants.push({ ...defined(values.variants[0]), title: "Preto / G", sku: "fox-v1-m" });
    const result = productFormSchema.safeParse(values);

    expect(result.success).toBe(false);
    expect(defined(result.error).issues[0]).toMatchObject({ path: ["variants", 1, "sku"] });
  });
});

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}
