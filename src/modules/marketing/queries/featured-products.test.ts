import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listApprovedProducts: vi.fn(), toProductCardData: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/products/queries/products", () => ({ listApprovedProducts: mocks.listApprovedProducts }));
vi.mock("@/modules/products/components/product-grid", () => ({ toProductCardData: mocks.toProductCardData }));

import { listFeaturedProducts } from "./featured-products";

beforeEach(() => {
  vi.clearAllMocks();
});

it("shows at most twelve approved products in stock, never inventing a showcase", async () => {
  mocks.listApprovedProducts.mockResolvedValue({ products: [{ id: "a" }, { id: "b" }] });
  mocks.toProductCardData.mockImplementation((product: { id: string }) => ({ id: product.id }));

  await expect(listFeaturedProducts()).resolves.toEqual([{ id: "a" }, { id: "b" }]);
  expect(mocks.listApprovedProducts).toHaveBeenCalledWith({ pageSize: 12, availability: "IN_STOCK" });
});

it("returns an empty list when no product qualifies, so the home shows its empty state", async () => {
  mocks.listApprovedProducts.mockResolvedValue({ products: [] });

  await expect(listFeaturedProducts()).resolves.toEqual([]);
  expect(mocks.toProductCardData).not.toHaveBeenCalled();
});
