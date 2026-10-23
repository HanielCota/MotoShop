import { expect, it } from "vitest";

import { sellerOnboardingSchema } from "./seller-onboarding";
import { splitStoreSlugIssue } from "./store-slug";

it("sends the identifier error to the field and the first other error to the form", () => {
  const parsed = sellerOnboardingSchema.safeParse({
    storeName: "",
    storeSlug: "Luiz Parts",
    originPostalCode: "01001000",
    type: "COMPANY",
  });
  if (parsed.success) throw new Error("expected an invalid onboarding form");

  expect(splitStoreSlugIssue(parsed.error, "storeSlug")).toEqual({
    error: "Informe o nome da loja.",
    slugError: "Use apenas letras minúsculas, números e hífens.",
  });
});

it("leaves the form message empty when only the identifier is wrong", () => {
  const parsed = sellerOnboardingSchema.safeParse({
    storeName: "Luiz Parts",
    storeSlug: "Luiz Parts",
    originPostalCode: "01001000",
    type: "COMPANY",
  });
  if (parsed.success) throw new Error("expected an invalid onboarding form");

  expect(splitStoreSlugIssue(parsed.error, "storeSlug")).toEqual({
    slugError: "Use apenas letras minúsculas, números e hífens.",
  });
});
