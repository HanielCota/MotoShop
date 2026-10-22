import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findItem: vi.fn(),
  findPhoto: vi.fn(),
  createUploadUrl: vi.fn(),
  verifyAsset: vi.fn(),
  deleteObject: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: { orderItem: { findFirst: mocks.findItem }, returnRequestPhoto: { findUnique: mocks.findPhoto } },
}));
vi.mock("@/modules/orders/application/resolve-customer-order-access", () => ({
  customerOrderIdentityWhere: (identity: { userId: string }) => ({ userId: identity.userId }),
}));
vi.mock("@/lib/storage/imagekit-storage-provider", () => ({
  ImageKitStorageProvider: class {
    createUploadUrl = mocks.createUploadUrl;
    verifyAsset = mocks.verifyAsset;
    deleteObject = mocks.deleteObject;
  },
}));

import { createReturnPhotoUpload, removeReturnPhotoUpload, verifyReturnPhotos } from "./return-photo-uploads";

const target = { orderNumber: "MS-1", orderItemId: "item-1", identity: { userId: "buyer-1" } };
const validKey = "returns/item-1/0b8a8f0e-6c38-4f8e-9f3c-1d2e3f4a5b6c.jpg";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findItem.mockResolvedValue({ id: "item-1", sellerOrder: { status: "DELIVERED" } });
  mocks.findPhoto.mockResolvedValue(null);
  mocks.createUploadUrl.mockImplementation(async ({ key }: { key: string }) => ({ key, url: "u", fields: {} }));
  mocks.verifyAsset.mockResolvedValue({ mediaType: "image", contentType: "image/jpeg", sizeInBytes: 2048 });
});

describe("createReturnPhotoUpload", () => {
  it("issues a private upload inside the item's folder, only for the customer's own order", async () => {
    await createReturnPhotoUpload(target, { contentType: "image/png", sizeInBytes: 1024 });

    expect(mocks.findItem).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "item-1",
          sellerOrder: { order: { orderNumber: "MS-1", userId: "buyer-1" } },
        },
      }),
    );
    expect(mocks.createUploadUrl).toHaveBeenCalledWith({
      key: expect.stringMatching(/^returns\/item-1\/[a-f0-9-]{36}\.png$/),
      contentType: "image/png",
      maxSizeInBytes: 5 * 1024 * 1024,
      isPrivate: true,
    });
  });

  it("refuses an item that is not in the customer's order", async () => {
    mocks.findItem.mockResolvedValue(null);

    await expect(createReturnPhotoUpload(target, { contentType: "image/png", sizeInBytes: 1 })).rejects.toThrow(
      "Item do pedido não encontrado",
    );
    expect(mocks.createUploadUrl).not.toHaveBeenCalled();
  });

  it("refuses photos before the delivery and photos over 5 MB", async () => {
    mocks.findItem.mockResolvedValue({ id: "item-1", sellerOrder: { status: "SHIPPED" } });
    await expect(createReturnPhotoUpload(target, { contentType: "image/png", sizeInBytes: 1 })).rejects.toThrow(
      "após a entrega",
    );
    await expect(
      createReturnPhotoUpload(target, { contentType: "image/png", sizeInBytes: 5 * 1024 * 1024 + 1 }),
    ).rejects.toThrow("até 5 MB");
    expect(mocks.createUploadUrl).not.toHaveBeenCalled();
  });
});

describe("verifyReturnPhotos", () => {
  it("requires each photo to be a private image inside the item's folder", async () => {
    const result = await verifyReturnPhotos("item-1", [{ key: validKey, fileId: "file-1" }]);

    expect(mocks.verifyAsset).toHaveBeenCalledWith({
      key: validKey,
      fileId: "file-1",
      maxSizeInBytes: 5 * 1024 * 1024,
      contentTypes: ["image/jpeg", "image/png", "image/webp"],
      requirePrivate: true,
    });
    expect(result).toEqual([{ storageKey: validKey, contentType: "image/jpeg", sizeInBytes: 2048, sortOrder: 0 }]);
  });

  it("refuses a photo from another item's folder without asking ImageKit", async () => {
    await expect(
      verifyReturnPhotos("item-1", [{ key: "returns/item-2/0b8a8f0e-6c38-4f8e-9f3c-1d2e3f4a5b6c.jpg", fileId: "f" }]),
    ).rejects.toThrow("Foto fora da devolução");
    expect(mocks.verifyAsset).not.toHaveBeenCalled();
  });

  it("refuses the same photo attached twice", async () => {
    const photo = { key: validKey, fileId: "file-1" };

    await expect(verifyReturnPhotos("item-1", [photo, photo])).rejects.toThrow("duas vezes");
  });

  it("refuses a photo that already belongs to another return with a clear message", async () => {
    mocks.findPhoto.mockResolvedValue({ id: "photo-of-first-return" });

    await expect(verifyReturnPhotos("item-1", [{ key: validKey, fileId: "file-1" }])).rejects.toThrow(
      "já faz parte de outra devolução",
    );
  });
});

describe("removeReturnPhotoUpload", () => {
  it("deletes a photo that never became part of a return", async () => {
    await removeReturnPhotoUpload(target, validKey);

    expect(mocks.deleteObject).toHaveBeenCalledWith({ key: validKey });
  });

  it("keeps a photo already attached to a return", async () => {
    mocks.findPhoto.mockResolvedValue({ id: "photo-1" });

    await expect(removeReturnPhotoUpload(target, validKey)).rejects.toThrow("já faz parte");
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("refuses a key outside the item's folder", async () => {
    await expect(removeReturnPhotoUpload(target, "products/seller-1/photo.webp")).rejects.toThrow("não encontrado");
    expect(mocks.findItem).not.toHaveBeenCalled();
  });
});
