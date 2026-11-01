import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { storefrontSkeletonHeightClassName } from "@/components/ui/skeleton";

import { suspenseFallbackIn } from "../../../../../../tests/support/suspense-fallback";

const mocks = vi.hoisted(() => ({
  motorcycle: vi.fn(),
  listProducts: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/modules/catalog/components/public-catalog-landing", () => ({ PublicCatalogLanding: () => null }));
vi.mock("@/modules/catalog/queries/public-catalog", () => ({ getPublicMotorcycleByYear: mocks.motorcycle }));
vi.mock("@/modules/products/queries/products", () => ({ listApprovedProducts: mocks.listProducts }));
vi.mock("@/modules/products/queries/variant-attribute-options", () => ({
  listPublicVariantAttributeOptions: vi.fn(),
}));

import MotorcyclePage from "./page";

function openMotorcycle(year: string) {
  return MotorcyclePage({
    params: Promise.resolve({ manufacturerSlug: "honda", modelSlug: "crf-250r", year }),
    searchParams: Promise.resolve({}),
  });
}

const crf250r = {
  name: "CRF 250R",
  slug: "crf-250r",
  manufacturer: { name: "Honda", slug: "honda" },
  fitments: [{ id: "fitment-1", version: "", displacementCc: 250, year: 2025 }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

it("answers 404 for a year that is not a four-digit year, without querying the database", async () => {
  await expect(openMotorcycle("99999999999999999999")).rejects.toThrow("not-found");

  expect(mocks.motorcycle).not.toHaveBeenCalled();
});

it("answers 404 for a model with no configuration in that year before any loading screen starts", async () => {
  mocks.motorcycle.mockResolvedValue({ ...crf250r, fitments: [] });

  await expect(openMotorcycle("1990")).rejects.toThrow("not-found");

  expect(mocks.motorcycle).toHaveBeenCalledWith("honda", "crf-250r", 1990);
});

it("answers 404 for a missing model before any loading screen starts", async () => {
  mocks.motorcycle.mockResolvedValue(null);

  await expect(openMotorcycle("2025")).rejects.toThrow("not-found");
});

// Regression (findings of 27/10/2026): a click on a motorcycle link left the previous page on screen until
// the whole motorcycle page arrived, as if nothing happened.
it("shows the product list loading screen while an existing motorcycle loads its products", async () => {
  mocks.motorcycle.mockResolvedValue(crf250r);

  const page = await openMotorcycle("2025");
  render(suspenseFallbackIn(page));

  expect(screen.getByRole("status", { name: "Carregando produtos" })).toHaveClass(storefrontSkeletonHeightClassName);
  expect(mocks.listProducts).not.toHaveBeenCalled();
});
