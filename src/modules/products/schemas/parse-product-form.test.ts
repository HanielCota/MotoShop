import { expect, it } from "vitest";

import { parseProductForm } from "./parse-product-form";

function productForm(variant: Record<string, string>) {
  const form = new FormData();
  form.set("name", "Camisa de motocross");
  form.set("description", "Camisa leve para trilha e motocross.");
  form.set("categoryId", "cmf8w8m4p0000s6o5zj2q8v3k");
  form.set("brandId", "cmf8w8m4p0001s6o5zj2q8v3k");
  form.append("variantId", "");
  form.append("variantTitle", "M / Preto");
  form.append("sku", "CAMISA-M-PRETO");
  form.append("price", "199,90");
  form.append("stock", "3");
  for (const [key, value] of Object.entries(variant)) form.append(key, value);
  return form;
}

it("reads gender, color and size of each variant", () => {
  const parsed = parseProductForm(
    productForm({ variantGender: "FEMALE", variantColor: " Preto/laranja ", variantSize: "M" }),
  );

  expect(parsed.success).toBe(true);
  expect(parsed.data?.variants[0]).toMatchObject({ gender: "FEMALE", color: "Preto/laranja", size: "M" });
});

it("keeps the new attributes empty when the seller leaves them blank", () => {
  const parsed = parseProductForm(productForm({ variantGender: "", variantColor: "", variantSize: "" }));

  expect(parsed.success).toBe(true);
  expect(parsed.data?.variants[0]).toMatchObject({ gender: null, color: null, size: null });
});

it("accepts forms sent before the new fields existed", () => {
  const parsed = parseProductForm(productForm({}));

  expect(parsed.success).toBe(true);
  expect(parsed.data?.variants[0]).toMatchObject({ gender: null, color: null, size: null });
});

it("refuses a gender outside the list in Portuguese", () => {
  const parsed = parseProductForm(productForm({ variantGender: "OTHER" }));

  expect(parsed.success).toBe(false);
  expect(parsed.error?.issues[0]?.message).toBe("Escolha um gênero da lista.");
});
