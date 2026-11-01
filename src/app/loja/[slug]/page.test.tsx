import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { storefrontSkeletonHeightClassName } from "@/components/ui/skeleton";

import { suspenseFallbackIn } from "../../../../tests/support/suspense-fallback";

const mocks = vi.hoisted(() => ({
  isPublicStore: vi.fn(),
  store: vi.fn(),
  listProducts: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/modules/catalog/queries/public-catalog", () => ({
  isPublicStoreSlug: mocks.isPublicStore,
  getPublicStoreBySlug: mocks.store,
}));
vi.mock("@/modules/products/queries/products", () => ({ listApprovedProducts: mocks.listProducts }));
vi.mock("@/modules/products/components/product-grid", () => ({ ProductGrid: () => null }));

import PublicStorePage from "./page";

function openStore(slug: string) {
  return PublicStorePage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

it("answers 404 for a missing or suspended store before any loading screen starts", async () => {
  mocks.isPublicStore.mockResolvedValue(false);

  await expect(openStore("nao-existe")).rejects.toThrow("not-found");

  expect(mocks.isPublicStore).toHaveBeenCalledWith("nao-existe");
  expect(mocks.store).not.toHaveBeenCalled();
});

// Regression (findings of 27/10/2026): a click on a store link left the previous page on screen until
// the whole store arrived, as if nothing happened.
it("shows the store loading screen while an existing store loads its banner, products and reviews", async () => {
  mocks.isPublicStore.mockResolvedValue(true);

  const page = await openStore("areia-motos");
  render(suspenseFallbackIn(page));

  expect(screen.getByRole("status", { name: "Carregando loja" })).toHaveClass(storefrontSkeletonHeightClassName);
  expect(mocks.store).not.toHaveBeenCalled();
  expect(mocks.listProducts).not.toHaveBeenCalled();
});
