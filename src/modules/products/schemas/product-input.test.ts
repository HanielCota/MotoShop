import { describe, expect, it } from "vitest";

import { productInputSchema } from "./product-input";

const baseInput = {
  name: "Capacete Fox V1",
  slug: "capacete-fox-v1",
  description: "Capacete para motocross com proteção e ventilação.",
  categoryId: "cmf8w8m4p0000s6o5zj2q8v3k",
  brandId: "cmf8w8m4p0001s6o5zj2q8v3k",
  motorcycleFitmentIds: [],
};

describe("productInputSchema", () => {
  it("accepts multiple variants with independent pricing and stock", () => {
    const result = productInputSchema.safeParse({
      ...baseInput,
      variants: [
        { title: "Preto / M", sku: "FOX-V1-M", priceInCents: 89990, stock: 3 },
        { title: "Preto / G", sku: "FOX-V1-G", priceInCents: 92990, stock: 5 },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("requires at least one variant", () => {
    const result = productInputSchema.safeParse({ ...baseInput, variants: [] });

    expect(result.success).toBe(false);
  });
});
