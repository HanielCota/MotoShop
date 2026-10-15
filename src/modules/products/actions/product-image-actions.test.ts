import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  productFindFirst: vi.fn(),
  imageCount: vi.fn(),
  imageCreate: vi.fn(),
  imageFindFirst: vi.fn(),
  imageFindMany: vi.fn(),
  imageUpdate: vi.fn(),
  imageDeleteMany: vi.fn(),
  deleteObject: vi.fn(),
  lock: vi.fn(),
  createUploadUrl: vi.fn(),
  verifyImage: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/lib/database", () => ({
  db: {
    product: { findFirst: mocks.productFindFirst },
    productImage: { count: mocks.imageCount, create: mocks.imageCreate, findFirst: mocks.imageFindFirst },
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        $queryRaw: mocks.lock,
        product: { findFirst: mocks.productFindFirst },
        productImage: {
          count: mocks.imageCount,
          create: mocks.imageCreate,
          findFirst: mocks.imageFindFirst,
          findMany: mocks.imageFindMany,
          update: mocks.imageUpdate,
          deleteMany: mocks.imageDeleteMany,
        },
      }),
  },
}));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireSellerAccess: vi.fn(async () => ({ seller: { id: "seller-a" } })),
}));
vi.mock("@/lib/storage/imagekit-storage-provider", () => ({
  ImageKitStorageProvider: class {
    createUploadUrl = mocks.createUploadUrl;
    verifyImage = mocks.verifyImage;
    deleteObject = mocks.deleteObject;
  },
}));
vi.mock("@/shared/storage/public-storage-url", () => ({ getPublicStorageUrl: vi.fn(() => null) }));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ assertRateLimit: vi.fn() }));

import {
  attachProductImageAction,
  createProductImageUploadUrlAction,
  discardProductImageUploadAction,
  removeProductImageAction,
  reorderProductImagesAction,
} from "./product-image-actions";

const productId = "cmf8w8m4p0000s6o5zj2q8v3k";
const imageId = "cmf8w8m4p0001s6o5zj2q8v3k";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.productFindFirst.mockResolvedValue({ id: productId, sellerId: "seller-a" });
  mocks.imageCount.mockResolvedValue(0);
  mocks.imageFindFirst.mockResolvedValue(null);
  mocks.deleteObject.mockResolvedValue(undefined);
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
  it("checks capacity again under the product lock before attaching", async () => {
    mocks.imageCount.mockResolvedValue(8);
    const result = await attachProductImageAction({
      productId,
      storageKey: `products/seller-a/${productId}/photo.jpg`,
      fileId: "123456789012345678901234",
    });
    expect(result.error).toContain("8 imagens");
    expect(mocks.lock).toHaveBeenCalled();
    expect(mocks.imageCreate).not.toHaveBeenCalled();
  });
  it("rejects an image if the product was submitted during upload", async () => {
    mocks.productFindFirst.mockResolvedValueOnce({ id: productId }).mockResolvedValueOnce(null);
    const result = await attachProductImageAction({
      productId,
      storageKey: `products/seller-a/${productId}/photo.jpg`,
      fileId: "123456789012345678901234",
    });
    expect(result.error).toContain("edição");
    expect(mocks.imageCreate).not.toHaveBeenCalled();
  });
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
      fileId: "123456789012345678901234",
    });

    expect(result.error).toMatch(/não pertence/i);
    expect(mocks.imageCreate).not.toHaveBeenCalled();
  });

  it("removes an uploaded file only while it is still unattached to this seller's product", async () => {
    const storageKey = `products/seller-a/${productId}/photo.jpg`;
    const result = await discardProductImageUploadAction({ productId, storageKey });

    expect(result).toEqual({});
    expect(mocks.deleteObject).toHaveBeenCalledWith({ key: storageKey });

    mocks.imageFindFirst.mockResolvedValueOnce({ id: "image-a" });
    await discardProductImageUploadAction({ productId, storageKey });
    expect(mocks.deleteObject).toHaveBeenCalledOnce();
  });

  it("cannot discard an upload under another seller's product prefix", async () => {
    const result = await discardProductImageUploadAction({
      productId,
      storageKey: `products/seller-b/${productId}/photo.jpg`,
    });

    expect(result.error).toMatch(/não pertence/i);
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("does not reorder the gallery of another seller's product", async () => {
    mocks.productFindFirst.mockResolvedValue(null);

    const result = await reorderProductImagesAction({ productId, imageIds: [imageId] });

    expect(result.error).toMatch(/não encontrado/i);
    expect(mocks.productFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: productId, sellerId: "seller-a" }) }),
    );
    expect(mocks.imageFindMany).not.toHaveBeenCalled();
    expect(mocks.imageUpdate).not.toHaveBeenCalled();
  });

  it("does not remove an image of another seller's product", async () => {
    const result = await removeProductImageAction({ imageId });

    expect(result.error).toMatch(/não encontrada/i);
    expect(mocks.imageFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: imageId, product: expect.objectContaining({ sellerId: "seller-a" }) }),
      }),
    );
    expect(mocks.imageDeleteMany).not.toHaveBeenCalled();
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });
});
