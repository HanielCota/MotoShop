import { describe, expect, it } from "vitest";

import { buildReturnPhotoKey, isReturnPhotoKeyOf } from "./return-photos";

describe("return photo keys", () => {
  const uuid = "0b8a8f0e-6c38-4f8e-9f3c-1d2e3f4a5b6c";

  it("builds the key inside the item's folder with the type's extension", () => {
    expect(buildReturnPhotoKey("item-1", uuid, "image/webp")).toBe(`returns/item-1/${uuid}.webp`);
  });

  it("accepts only keys generated for that item", () => {
    expect(isReturnPhotoKeyOf("item-1", `returns/item-1/${uuid}.jpg`)).toBe(true);
    expect(isReturnPhotoKeyOf("item-1", `returns/item-2/${uuid}.jpg`)).toBe(false);
    expect(isReturnPhotoKeyOf("item-1", `returns/item-1/../item-2/${uuid}.jpg`)).toBe(false);
    expect(isReturnPhotoKeyOf("item-1", `returns/item-1/${uuid}.svg`)).toBe(false);
  });
});
