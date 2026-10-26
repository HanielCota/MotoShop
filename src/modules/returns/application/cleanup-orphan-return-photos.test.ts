import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/storage/imagekit-storage-provider", () => ({ ImageKitStorageProvider: class {} }));

import {
  cleanupOrphanReturnPhotos,
  ORPHAN_RETURN_PHOTO_CLEANUP_DELETES_FILES,
  type OrphanCleanupDependencies,
} from "./cleanup-orphan-return-photos";

const itemId = "cjld2cjxh0000qzrmn831i7rn";
const now = new Date("2026-10-23T07:41:00Z");

function file(name: string, folder = `returns/${itemId}`) {
  return { fileId: `id-${name}`, filePath: `/${folder}/${name}`, createdAt: new Date("2026-10-20T10:00:00Z") };
}

const attachedPhoto = file("0b8a8f0e-6c38-4f8e-9f3c-1d2e3f4a5b6c.jpg");
const orphanPhoto = file("6f1c2c1e-6c1a-4e0b-9b3f-2f8f5f7f8a11.png");
const productImage = file("capacete.webp", "products/seller-a");
const oddName = file("not-a-return-photo.jpg");

function dependencies(overrides: Partial<OrphanCleanupDependencies> = {}): OrphanCleanupDependencies {
  return {
    listFiles: vi.fn(async () => [attachedPhoto, orphanPhoto, productImage, oddName]),
    deleteFiles: vi.fn(async () => undefined),
    findAttachedStorageKeys: vi.fn(async () => new Set([attachedPhoto.filePath.slice(1)])),
    deletesFiles: false,
    now,
    ...overrides,
  };
}

describe("orphan return photo cleanup", () => {
  it("ships in dry-run mode: nothing is deleted until a reviewed change turns it on", () => {
    expect(ORPHAN_RETURN_PHOTO_CLEANUP_DELETES_FILES).toBe(false);
  });

  it("lists only return photos older than a day and reports the ones no return uses, without deleting", async () => {
    const deps = dependencies();

    const summary = await cleanupOrphanReturnPhotos(deps);

    expect(deps.listFiles).toHaveBeenCalledWith({
      folder: "returns",
      createdBefore: new Date("2026-10-22T07:41:00Z"),
      skip: 0,
      limit: 100,
    });
    expect(deps.findAttachedStorageKeys).toHaveBeenCalledWith([
      attachedPhoto.filePath.slice(1),
      orphanPhoto.filePath.slice(1),
    ]);
    expect(summary).toEqual({
      scanned: 4,
      orphans: 1,
      deleted: 0,
      apiCalls: 1,
      orphanPaths: [orphanPhoto.filePath],
    });
    expect(deps.deleteFiles).not.toHaveBeenCalled();
  });

  it("deletes only the orphan return photos when switched on, never product images or odd names", async () => {
    const deps = dependencies({ deletesFiles: true });

    const summary = await cleanupOrphanReturnPhotos(deps);

    expect(deps.deleteFiles).toHaveBeenCalledWith([orphanPhoto.fileId]);
    expect(summary).toMatchObject({ orphans: 1, deleted: 1, apiCalls: 2 });
  });

  it("moves the next page back by the files it deleted, so no file is skipped", async () => {
    const page = (offset: number, length: number) =>
      Array.from({ length }, (_, index) =>
        file(`0b8a8f0e-6c38-4f8e-9f3c-${String(offset + index).padStart(12, "0")}.jpg`),
      );
    const firstPage = page(0, 100);
    const secondPage = page(100, 30);
    const attachedKeys = new Set(firstPage.slice(0, 60).map((photo) => photo.filePath.slice(1)));
    const listFiles = vi.fn(async ({ skip }: { skip: number }) => (skip === 0 ? firstPage : secondPage));
    const deps = dependencies({
      deletesFiles: true,
      listFiles,
      findAttachedStorageKeys: vi.fn(async () => attachedKeys),
    });

    const summary = await cleanupOrphanReturnPhotos(deps);

    expect(listFiles.mock.calls.map(([input]) => input.skip)).toEqual([0, 60]);
    expect(deps.deleteFiles).toHaveBeenNthCalledWith(
      1,
      firstPage.slice(60).map((photo) => photo.fileId),
    );
    expect(deps.deleteFiles).toHaveBeenNthCalledWith(
      2,
      secondPage.map((photo) => photo.fileId),
    );
    expect(summary).toMatchObject({ scanned: 130, orphans: 70, deleted: 70, apiCalls: 4 });
  });

  it("stops after ten pages, so a run makes at most ten listing calls", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) =>
      file(`0b8a8f0e-6c38-4f8e-9f3c-${String(index).padStart(12, "0")}.jpg`),
    );
    const deps = dependencies({
      listFiles: vi.fn(async () => fullPage),
      findAttachedStorageKeys: vi.fn(async (keys: readonly string[]) => new Set(keys)),
    });

    const summary = await cleanupOrphanReturnPhotos(deps);

    expect(deps.listFiles).toHaveBeenCalledTimes(10);
    expect(summary).toMatchObject({ scanned: 1000, orphans: 0, apiCalls: 10 });
  });
});
