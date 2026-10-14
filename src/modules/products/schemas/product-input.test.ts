import { expect, it } from "vitest";

import { ownShippingMethodSchema } from "@/modules/shipping/domain/own-shipping";

import { productInputSchema } from "./product-input";

const englishZodMessage = /Too (small|big)|Invalid|expected/i;

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

it("answers every product validation problem in Portuguese (BUG-007)", () => {
  const result = productInputSchema.safeParse({
    name: "x".repeat(161),
    slug: "",
    description: "y".repeat(5_001),
    categoryId: "categoria",
    brandId: "marca",
    variants: [
      { title: "t".repeat(101), sku: "s".repeat(81), priceInCents: 1.5, promotionalPriceInCents: -1, stock: "a" },
    ],
    motorcycleFitmentIds: ["moto"],
  });

  expect(result.success).toBe(false);
  expect(messages(result)).toContain("Use no máximo 160 caracteres no nome.");
  expect(messages(result)).toContain("Use pelo menos 3 letras ou números no slug.");
  expect(messages(result).filter((message) => englishZodMessage.test(message))).toEqual([]);
});

it("answers every own shipping validation problem in Portuguese (BUG-007)", () => {
  const result = ownShippingMethodSchema.safeParse({
    name: "ab",
    postalCodeStart: "123",
    postalCodeEnd: "0",
    priceInCents: -1,
    estimatedDeliveryDays: 0,
  });

  expect(result.success).toBe(false);
  expect(messages(result)).toContain("Use pelo menos 3 caracteres no nome da entrega.");
  expect(messages(result).filter((message) => englishZodMessage.test(message))).toEqual([]);
});
