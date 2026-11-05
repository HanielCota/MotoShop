import { describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createReturnPhotoUploadAction: vi.fn(),
  removeReturnPhotoUploadAction: vi.fn(),
}));
vi.mock("../actions/return-actions", () => actions);

import { discardReturnPhotos, validateReturnPhotoSelection } from "./return-photo-picker";

const rules = { maxPhotos: 3, maxSizeInBytes: 5 * 1024 * 1024 };

function photo(name: string, type = "image/jpeg", size = 1024) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("validateReturnPhotoSelection", () => {
  it("accepts up to three JPG, PNG or WebP photos", () => {
    expect(validateReturnPhotoSelection([photo("a.jpg")], [photo("b.png", "image/png")], rules)).toBeNull();
  });

  it("refuses a fourth photo", () => {
    const three = [photo("a.jpg"), photo("b.jpg"), photo("c.jpg")];
    expect(validateReturnPhotoSelection(three, [photo("d.jpg")], rules)).toBe("Anexe no máximo 3 fotos.");
  });

  it("refuses other file types and photos over 5 MB", () => {
    expect(validateReturnPhotoSelection([], [photo("a.gif", "image/gif")], rules)).toBe(
      'A imagem "a.gif" precisa ser JPG, PNG ou WebP e ter até 5 MB.',
    );
    expect(validateReturnPhotoSelection([], [photo("big.jpg", "image/jpeg", 5 * 1024 * 1024 + 1)], rules)).toBe(
      'A imagem "big.jpg" precisa ser JPG, PNG ou WebP e ter até 5 MB.',
    );
  });
});

describe("validateReturnPhotoSelection with the Admin limits", () => {
  it("follows the photo count configured in the Admin", () => {
    const one = { ...rules, maxPhotos: 1 };

    expect(validateReturnPhotoSelection([], [photo("a.jpg"), photo("b.jpg")], one)).toBe("Anexe no máximo 1 foto.");
    expect(validateReturnPhotoSelection([], [photo("a.jpg")], one)).toBeNull();
  });

  it("checks every photo against the configured size, not against its position in the selection", () => {
    const selection = [photo("a.jpg", "image/jpeg", 2048), photo("b.jpg", "image/jpeg", 2048)];

    expect(validateReturnPhotoSelection([], selection, rules)).toBeNull();
  });
});

describe("discardReturnPhotos", () => {
  it("tries every photo and does not throw when one delete fails", async () => {
    actions.removeReturnPhotoUploadAction.mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce({});
    const target = { orderNumber: "MS-1", orderItemId: "item-1" };

    await expect(
      discardReturnPhotos(target, [
        { key: "returns/item-1/a.jpg", fileId: "file-a" },
        { key: "returns/item-1/b.jpg", fileId: "file-b" },
      ]),
    ).resolves.toBeUndefined();
    expect(actions.removeReturnPhotoUploadAction).toHaveBeenCalledTimes(2);
    expect(actions.removeReturnPhotoUploadAction).toHaveBeenLastCalledWith({ ...target, key: "returns/item-1/b.jpg" });
  });
});
