import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findStore: vi.fn(),
  updateStore: vi.fn(),
  createAudit: vi.fn(),
  requireSellerAccess: vi.fn(),
  verifyImage: vi.fn(),
  deleteObject: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/storage/public-storage-url", () => ({
  getPublicStorageUrl: (key: string) => `https://cdn.example.test/${key}`,
}));
vi.mock("@/lib/database", () => ({
  db: {
    $transaction: mocks.transaction,
    store: { findFirst: mocks.findStore },
  },
}));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ assertRateLimit: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({ requireSellerAccess: mocks.requireSellerAccess }));
vi.mock("@/lib/storage/imagekit-storage-provider", () => ({
  ImageKitStorageProvider: class {
    verifyImage = mocks.verifyImage;
    deleteObject = mocks.deleteObject;
  },
}));

import { attachStoreBrandingImageAction, discardStoreBrandingUploadAction } from "./store-branding-actions";

const context = {
  seller: { id: "seller-1" },
  store: { id: "store-1" },
  session: { user: { id: "user-1" } },
};
const previousStore = {
  id: "store-1",
  slug: "moto-sandbox",
  logoStorageKey: null,
  bannerStorageKey: null,
};
const updatedStore = { ...previousStore, logoStorageKey: "stores/seller-1/logo/asset.jpg" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSellerAccess.mockResolvedValue(context);
  mocks.verifyImage.mockResolvedValue(undefined);
  mocks.deleteObject.mockResolvedValue(undefined);
  mocks.findStore.mockResolvedValue(previousStore);
  mocks.updateStore.mockResolvedValue(updatedStore);
  mocks.createAudit.mockResolvedValue({ id: "audit-1" });
  mocks.transaction.mockImplementation(async (callback) =>
    callback({
      store: { findFirst: mocks.findStore, update: mocks.updateStore },
      auditLog: { create: mocks.createAudit },
    }),
  );
});

it("updates branding and its audit event in the same transaction", async () => {
  const result = await attachStoreBrandingImageAction({
    imageType: "logo",
    storageKey: "stores/seller-1/logo/12345678-1234-4234-8234-123456789abc.jpg",
    fileId: "123456789012345678901234",
  });

  expect(result).toMatchObject({ image: { imageType: "logo" } });
  expect(mocks.transaction).toHaveBeenCalledOnce();
  expect(mocks.createAudit).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: "STORE_BRANDING_UPDATED",
      entityId: "store-1",
      actorUserId: "user-1",
    }),
  });
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/loja/moto-sandbox");
});

it("does not revalidate or report success when the audit event fails", async () => {
  mocks.createAudit.mockRejectedValue(new Error("audit unavailable"));

  const result = await attachStoreBrandingImageAction({
    imageType: "logo",
    storageKey: "stores/seller-1/logo/12345678-1234-4234-8234-123456789abc.jpg",
    fileId: "123456789012345678901234",
  });

  expect(result).toHaveProperty("error");
  expect(mocks.updateStore).toHaveBeenCalledOnce();
  expect(mocks.transaction).toHaveBeenCalledOnce();
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
});

it("discards only an unassociated branding image under this seller's store prefix", async () => {
  mocks.findStore.mockResolvedValue({ logoStorageKey: null });
  const storageKey = "stores/seller-1/logo/12345678-1234-4234-8234-123456789abc.jpg";

  expect(await discardStoreBrandingUploadAction({ imageType: "logo", storageKey })).toEqual({});
  expect(mocks.deleteObject).toHaveBeenCalledWith({ key: storageKey });

  mocks.findStore.mockResolvedValueOnce({ logoStorageKey: storageKey });
  await discardStoreBrandingUploadAction({ imageType: "logo", storageKey });
  expect(mocks.deleteObject).toHaveBeenCalledOnce();

  const otherSellerKey = "stores/seller-2/logo/12345678-1234-4234-8234-123456789abc.jpg";
  expect(await discardStoreBrandingUploadAction({ imageType: "logo", storageKey: otherSellerKey })).toHaveProperty(
    "error",
  );
  expect(mocks.deleteObject).toHaveBeenCalledOnce();
});
