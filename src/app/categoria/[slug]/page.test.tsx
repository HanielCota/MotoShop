import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { storefrontSkeletonHeightClassName } from "@/components/ui/skeleton";

import { suspenseFallbackIn } from "../../../../tests/support/suspense-fallback";

const mocks = vi.hoisted(() => ({
  category: vi.fn(),
  listProducts: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/modules/catalog/components/public-catalog-landing", () => ({ PublicCatalogLanding: () => null }));
vi.mock("@/modules/catalog/queries/public-catalog", () => ({ getPublicCategoryBySlug: mocks.category }));
vi.mock("@/modules/products/queries/products", () => ({ listApprovedProducts: mocks.listProducts }));
vi.mock("@/modules/products/queries/variant-attribute-options", () => ({
  listPublicVariantAttributeOptions: vi.fn(),
}));

import CategoryPage from "./page";

function openCategory(slug: string) {
  return CategoryPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

it("answers 404 for a missing category before any loading screen starts", async () => {
  mocks.category.mockResolvedValue(null);

  await expect(openCategory("nao-existe")).rejects.toThrow("not-found");

  expect(mocks.category).toHaveBeenCalledWith("nao-existe");
});

// Regression (findings of 27/10/2026): a click on a category link left the previous page on screen until
// the whole category arrived, as if nothing happened.
it("shows the product list loading screen while an existing category loads its products", async () => {
  mocks.category.mockResolvedValue({ id: "category-1", name: "Capacetes", slug: "capacetes", parent: null });

  const page = await openCategory("capacetes");
  render(suspenseFallbackIn(page));

  expect(screen.getByRole("status", { name: "Carregando produtos" })).toHaveClass(storefrontSkeletonHeightClassName);
  expect(mocks.listProducts).not.toHaveBeenCalled();
});
