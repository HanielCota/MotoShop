import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  productFindFirst: vi.fn(),
  imageCount: vi.fn(),
  imageCreate: vi.fn(),
  createUploadUrl: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/lib/database", () => ({
  db: {
    product: { findFirst: mocks.productFindFirst },
    productImage: { count: mocks.imageCount, create: mocks.imageCreate },
  },
}));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireSellerAccess: vi.fn(async () => ({ seller: { id: "seller-a" } })),
}));
vi.mock("@/lib/storage/r2-storage-provider", () => ({
  R2StorageProvider: class {
    createUploadUrl = mocks.createUploadUrl;
  },
}));
vi.mock("@/shared/storage/public-storage-url", () => ({ getPublicStorageUrl: vi.fn(() => null) }));

import { attachProductImageAction, createProductImageUploadUrlAction } from "./product-image-actions";

const productId = "cmf8w8m4p0000s6o5zj2q8v3k";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.productFindFirst.mockResolvedValue({ id: productId, sellerId: "seller-a" });
  mocks.imageCount.mockResolvedValue(0);
  mocks.createUploadUrl.mockResolvedValue({
    key: `products/seller-a/${productId}/photo.jpg`,
    url: "https://storage.example.test/upload",
    expiresAt: new Date("2026-09-23T12:00:00.000Z"),
  });
  mocks.imageCreate.mockResolvedValue({
    id: "image-a",
    storageKey: `products/seller-a/${productId}/photo.jpg`,
    altText: "Capacete",
  });
});

describe("seller product image upload", () => {
  it("creates a short-lived upload URL under the seller's product prefix", async () => {
    const result = await createProductImageUploadUrlAction({
      productId,
      contentType: "image/jpeg",
      sizeInBytes: 1000,
    });

    expect(result).toHaveProperty("url", "https://storage.example.test/upload");
    expect(mocks.productFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: productId, sellerId: "seller-a" }) }),
    );
    expect(mocks.createUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ key: expect.stringMatching(new RegExp(`^products/seller-a/${productId}/`)) }),
    );
  });

  it("rejects an image key belonging to another seller", async () => {
    const result = await attachProductImageAction({
      productId,
      storageKey: `products/seller-b/${productId}/photo.jpg`,
    });

    expect(result.error).toMatch(/não pertence/i);
    expect(mocks.imageCreate).not.toHaveBeenCalled();
  });
});
