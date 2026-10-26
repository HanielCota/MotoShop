import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/database", () => ({ db: { productImage: { findMany: mocks.findMany } } }));
vi.mock("@/shared/storage/public-storage-url", () => ({
  getPublicStorageUrl: (storageKey: string) => `https://ik.example/${storageKey}`,
}));

import { getOrderItemThumbnails } from "./order-item-thumbnails";

beforeEach(() => {
  mocks.findMany.mockReset();
});

it("keys each photo by order item, preferring the variant photo, and skips items whose product was deleted", async () => {
  mocks.findMany.mockResolvedValue([
    { productId: "product-a", storageKey: "a-first.jpg", variantId: null, altText: null },
    { productId: "product-a", storageKey: "a-red.jpg", variantId: "variant-red", altText: null },
  ]);

  const thumbnails = await getOrderItemThumbnails([
    { id: "item-red", productId: "product-a", variantId: "variant-red" },
    { id: "item-gone-variant", productId: "product-a", variantId: null },
    { id: "item-gone-product", productId: null, variantId: null },
  ]);

  expect(thumbnails.get("item-red")?.url).toBe("https://ik.example/a-red.jpg");
  expect(thumbnails.get("item-gone-variant")?.url).toBe("https://ik.example/a-first.jpg");
  expect(thumbnails.has("item-gone-product")).toBe(false);
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { productId: { in: ["product-a"] } } }));
});

it("does not query the database when no item still has its product", async () => {
  expect((await getOrderItemThumbnails([{ id: "item", productId: null, variantId: null }])).size).toBe(0);
  expect(mocks.findMany).not.toHaveBeenCalled();
});
