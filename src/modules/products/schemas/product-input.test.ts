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
  const variant = { title: "M", sku: "SKU-M", priceInCents: 10000, stock: 2 };
  it("accepts packaging overrides and a scheduled promotion", () => {
    const result = productInputSchema.safeParse({
      ...baseInput,
      weightInGrams: 1000,
      variants: [
        {
          ...variant,
          weightInGrams: 1200,
          promotionalPriceInCents: 8000,
          promotionStartsAt: new Date("2026-09-24T12:00:00Z"),
          promotionEndsAt: new Date("2026-09-25T12:00:00Z"),
        },
      ],
    });
    expect(result.success).toBe(true);
  });
  it.each([0, -1, 1.5, 2147483648])("rejects invalid packaging measurement %s", (weightInGrams) => {
    expect(productInputSchema.safeParse({ ...baseInput, weightInGrams, variants: [variant] }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...baseInput, variants: [{ ...variant, weightInGrams }] }).success).toBe(
      false,
    );
  });
  it.each([0, -1, 10000, 11000, 99.5])("rejects invalid promotional price %s", (promotionalPriceInCents) => {
    expect(
      productInputSchema.safeParse({ ...baseInput, variants: [{ ...variant, promotionalPriceInCents }] }).success,
    ).toBe(false);
  });
  it("rejects dates without a price and a reversed period", () => {
    const start = new Date("2026-09-24T12:00:00Z");
    expect(
      productInputSchema.safeParse({ ...baseInput, variants: [{ ...variant, promotionStartsAt: start }] }).success,
    ).toBe(false);
    expect(
      productInputSchema.safeParse({
        ...baseInput,
        variants: [{ ...variant, promotionalPriceInCents: 5000, promotionStartsAt: start, promotionEndsAt: start }],
      }).success,
    ).toBe(false);
  });
  it("allows open-ended promotions and removal", () => {
    expect(
      productInputSchema.safeParse({ ...baseInput, variants: [{ ...variant, promotionalPriceInCents: 5000 }] }).success,
    ).toBe(true);
    expect(
      productInputSchema.safeParse({
        ...baseInput,
        variants: [{ ...variant, promotionalPriceInCents: null, promotionStartsAt: null, promotionEndsAt: null }],
      }).success,
    ).toBe(true);
  });
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

  it.each([1.5, 2147483648])("rejects stock %s that does not fit an int4 column", (stock) => {
    const result = productInputSchema.safeParse({ ...baseInput, variants: [{ ...variant, stock }] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/estoque/i);
  });

  it("requires at least one variant", () => {
    const result = productInputSchema.safeParse({ ...baseInput, variants: [] });

    expect(result.success).toBe(false);
  });
});
