import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { suspenseFallbackIn } from "../../../../../../../../tests/support/suspense-fallback";

const mocks = vi.hoisted(() => ({
  isEditable: vi.fn(),
  getProduct: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireSellerAccess: vi.fn(async () => ({ seller: { id: "seller-1" } })),
}));
vi.mock("@/modules/products/queries/seller-product-for-edit", () => ({
  isSellerProductEditable: mocks.isEditable,
  getSellerProductForEdit: mocks.getProduct,
}));
vi.mock("@/modules/products/queries/products", () => ({
  listProductCategories: vi.fn(async () => []),
  listProductBrands: vi.fn(async () => []),
}));
vi.mock("@/modules/catalog/queries/admin-catalog", () => ({
  listActiveMotorcycleFitmentsForProduct: vi.fn(async () => []),
}));
vi.mock("@/modules/products/components/product-edit-form", () => ({ ProductEditForm: () => null }));
vi.mock("@/modules/products/components/product-image-manager", () => ({ ProductImageManager: () => null }));
vi.mock("@/modules/products/components/product-submission-action", () => ({ ProductSubmissionAction: () => null }));
vi.mock("@/shared/storage/public-storage-url", () => ({ getPublicStorageUrl: vi.fn() }));

import EditProductPage from "./page";

function openEditPage(productId: string) {
  return EditProductPage({ params: Promise.resolve({ id: productId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

it("answers 404 for a product this store cannot edit, checking it against the signed-in store", async () => {
  mocks.isEditable.mockResolvedValue(false);

  await expect(openEditPage("product-of-another-store")).rejects.toThrow("not-found");

  expect(mocks.isEditable).toHaveBeenCalledWith("seller-1", "product-of-another-store");
  expect(mocks.getProduct).not.toHaveBeenCalled();
});

// Regression (findings of 27/10/2026): a click on "Editar" left the product list on screen until the whole
// form arrived, as if nothing happened.
it("shows the product form loading screen while an editable product loads", async () => {
  mocks.isEditable.mockResolvedValue(true);

  const page = await openEditPage("product-1");
  render(suspenseFallbackIn(page));

  expect(screen.getByRole("status", { name: "Carregando produto" })).toBeInTheDocument();
  expect(mocks.getProduct).not.toHaveBeenCalled();
});
