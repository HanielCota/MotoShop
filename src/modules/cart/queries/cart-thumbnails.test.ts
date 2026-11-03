import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { warn: mocks.warn } }));
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), warn: vi.fn() }));
vi.mock("@/lib/database", () => ({ db: { productImage: { findMany: mocks.findMany } } }));
vi.mock("@/shared/storage/public-storage-url", () => ({
  getPublicStorageUrl: (storageKey: string) =>
    storageKey === "unpublished" ? null : `https://ik.example/${storageKey}`,
}));

import { getCartThumbnails } from "./cart-thumbnails";

const image = (productId: string, storageKey: string, variantId: string | null = null) => ({
  productId,
  storageKey,
  variantId,
  altText: `${storageKey} alt`,
});

beforeEach(() => {
  mocks.findMany.mockReset();
});

it("uses the variant's own photo, falls back to the product's first photo and skips items without one", async () => {
  mocks.findMany.mockResolvedValue([
    image("product-a", "a-first.jpg"),
    image("product-a", "a-red.jpg", "variant-red"),
    image("product-b", "unpublished"),
  ]);

  const thumbnails = await getCartThumbnails([
    { variantId: "variant-red", variant: { productId: "product-a" } },
    { variantId: "variant-blue", variant: { productId: "product-a" } },
    { variantId: "variant-b", variant: { productId: "product-b" } },
    { variantId: "variant-c", variant: { productId: "product-c" } },
  ]);

  expect(thumbnails.get("variant-red")).toEqual({ url: "https://ik.example/a-red.jpg", alt: "a-red.jpg alt" });
  expect(thumbnails.get("variant-blue")).toEqual({ url: "https://ik.example/a-first.jpg", alt: "a-first.jpg alt" });
  expect(thumbnails.has("variant-b")).toBe(false);
  expect(thumbnails.has("variant-c")).toBe(false);
  expect(mocks.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { productId: { in: ["product-a", "product-b", "product-c"] } } }),
  );
});

it("does not query the database for an empty cart", async () => {
  expect((await getCartThumbnails([])).size).toBe(0);
  expect(mocks.findMany).not.toHaveBeenCalled();
});

it("returns no thumbnails instead of failing when the image query fails", async () => {
  mocks.findMany.mockRejectedValue(new Error("database unavailable"));

  const thumbnails = await getCartThumbnails([{ variantId: "variant-a", variant: { productId: "product-a" } }]);

  expect(thumbnails.size).toBe(0);
  expect(mocks.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "catalog.thumbnails_unavailable" }));
});
