import { describe, expect, it } from "vitest";

import { initialCheckoutForm, validateCheckoutFieldOnBlur, type CheckoutFormState } from "./checkout-form-model";

function formWith(values: Partial<CheckoutFormState>): CheckoutFormState {
  return { ...initialCheckoutForm, ...values };
}

describe("validateCheckoutFieldOnBlur", () => {
  it.each([
    ["customerTaxId", "232.030.293-20", "Informe um CPF válido."],
    ["customerTaxId", "111.111.111-11", "Informe um CPF válido."],
    ["customerPhone", "(00) 12345-6789", "Informe um telefone válido."],
    ["customerPhone", "(11) 1234", "Informe um telefone válido."],
    ["customerEmail", "luiz@semdominio", "Informe um e-mail válido."],
    ["customerEmail", "luiz semarroba.com", "Informe um e-mail válido."],
    ["postalCode", "12345", "Informe um CEP com 8 números."],
  ] as const)("flags %s %j when the person leaves it", (field, value, message) => {
    const form = formWith({ [field]: value });

    expect(validateCheckoutFieldOnBlur(form, field)).toBe(message);
  });

  it.each([
    ["customerTaxId", "191.191.191-00"],
    ["customerPhone", "(11) 98765-4321"],
    ["customerEmail", "luiz@example.test"],
    ["postalCode", "01310-100"],
  ] as const)("accepts a valid %s %j", (field, value) => {
    const form = formWith({ [field]: value });

    expect(validateCheckoutFieldOnBlur(form, field)).toBeUndefined();
  });

  it("waits for the submit on a blank field and on fields outside the blur check", () => {
    expect(validateCheckoutFieldOnBlur(formWith({ customerTaxId: "  " }), "customerTaxId")).toBeUndefined();
    expect(validateCheckoutFieldOnBlur(formWith({ street: "R" }), "street")).toBeUndefined();
  });
});
