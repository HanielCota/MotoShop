import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { storefrontSkeletonHeightClassName } from "@/components/ui/skeleton";

import { suspenseFallbackIn } from "../../../../tests/support/suspense-fallback";

const mocks = vi.hoisted(() => ({
  brand: vi.fn(),
  listProducts: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/modules/catalog/components/public-catalog-landing", () => ({ PublicCatalogLanding: () => null }));
vi.mock("@/modules/catalog/queries/public-catalog", () => ({ getPublicBrandBySlug: mocks.brand }));
vi.mock("@/modules/products/queries/products", () => ({ listApprovedProducts: mocks.listProducts }));
vi.mock("@/modules/products/queries/variant-attribute-options", () => ({
  listPublicVariantAttributeOptions: vi.fn(),
}));

import BrandPage from "./page";

function openBrand(slug: string) {
  return BrandPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

it("answers 404 for a missing brand before any loading screen starts", async () => {
  mocks.brand.mockResolvedValue(null);

  await expect(openBrand("nao-existe")).rejects.toThrow("not-found");

  expect(mocks.brand).toHaveBeenCalledWith("nao-existe");
});

// Regression (findings of 27/10/2026): a click on a brand link left the previous page on screen until
// the whole brand page arrived, as if nothing happened.
it("shows the product list loading screen while an existing brand loads its products", async () => {
  mocks.brand.mockResolvedValue({ id: "brand-1", name: "Fox", slug: "fox" });

  const page = await openBrand("fox");
  render(suspenseFallbackIn(page));

  expect(screen.getByRole("status", { name: "Carregando produtos" })).toHaveClass(storefrontSkeletonHeightClassName);
  expect(mocks.listProducts).not.toHaveBeenCalled();
});
