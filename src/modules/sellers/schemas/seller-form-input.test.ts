import { expect, it } from "vitest";

import { readSellerOnboardingInput, validateSellerOnboardingForm } from "./seller-onboarding";
import { validateStoreProfileForm } from "./store-profile";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

it("reads the sign-up like the server: identifier converted and postal code digits only", () => {
  expect(
    readSellerOnboardingInput(
      form({ storeName: "Luiz Parts", storeSlug: "Luiz Parts", originPostalCode: "01001-000", type: "COMPANY" }),
    ),
  ).toEqual({ storeName: "Luiz Parts", storeSlug: "luiz-parts", originPostalCode: "01001000", type: "COMPANY" });
});

it("validates the sign-up and the store profile with the server schemas (BUG-011)", () => {
  expect(
    validateSellerOnboardingForm(
      form({ storeName: "Luiz Parts", storeSlug: "luiz-parts", originPostalCode: "01001-000", type: "COMPANY" }),
    ),
  ).toBeNull();
  expect(
    validateSellerOnboardingForm(form({ storeName: "L", storeSlug: "!!!", originPostalCode: "123", type: "COMPANY" })),
  ).toEqual({
    error: "Informe o nome da loja.",
    field: "storeName",
    slugError: "Informe um identificador para a loja.",
  });
  expect(validateStoreProfileForm(form({ name: "Garagem MX", slug: "garagem-mx", instagramUrl: "http://x" }))).toEqual({
    error: "Use um link seguro iniciado por https://.",
    field: "instagramUrl",
  });
});
