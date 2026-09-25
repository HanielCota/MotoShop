import { expect, it } from "vitest";

import { checkoutSchema } from "../schemas/checkout";
import { isValidCpf } from "./cpf";

it("accepts a valid CPF and normalizes punctuation before payment", () => {
  expect(isValidCpf("19119119100")).toBe(true);
  expect(checkoutSchema.shape.customerTaxId.parse("191.191.191-00")).toBe("19119119100");
});

it("rejects missing, repeated and incorrect CPF numbers", () => {
  expect(checkoutSchema.shape.customerTaxId.safeParse("").success).toBe(false);
  expect(isValidCpf("11111111111")).toBe(false);
  expect(isValidCpf("19119119101")).toBe(false);
});
