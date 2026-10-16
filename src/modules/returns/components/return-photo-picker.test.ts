import { describe, expect, it, vi } from "vitest";

vi.mock("../actions/return-actions", () => ({
  createReturnPhotoUploadAction: vi.fn(),
  removeReturnPhotoUploadAction: vi.fn(),
}));

import { validateReturnPhotoSelection } from "./return-photo-picker";

function photo(name: string, type = "image/jpeg", size = 1024) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("validateReturnPhotoSelection", () => {
  it("accepts up to three JPG, PNG or WebP photos", () => {
    expect(validateReturnPhotoSelection([photo("a.jpg")], [photo("b.png", "image/png")])).toBeNull();
  });

  it("refuses a fourth photo", () => {
    const three = [photo("a.jpg"), photo("b.jpg"), photo("c.jpg")];
    expect(validateReturnPhotoSelection(three, [photo("d.jpg")])).toBe("Anexe no máximo 3 fotos.");
  });

  it("refuses other file types and photos over 5 MB", () => {
    expect(validateReturnPhotoSelection([], [photo("a.gif", "image/gif")])).toBe("Use imagens JPG, PNG ou WebP.");
    expect(validateReturnPhotoSelection([], [photo("big.jpg", "image/jpeg", 5 * 1024 * 1024 + 1)])).toMatch(
      /passa de 5 MB/,
    );
  });
});
