import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({ env: { IMAGEKIT_URL_ENDPOINT: "https://ik.imagekit.io/motoshop/" } }));

import { getPublicStorageImageUrl, getPublicStorageUrl } from "./public-storage-url";

describe("getPublicStorageImageUrl", () => {
  it("asks ImageKit for the requested width", () => {
    expect(getPublicStorageImageUrl("sellers/s1/products/p1/foto 1.webp", 640)).toBe(
      "https://ik.imagekit.io/motoshop/sellers/s1/products/p1/foto%201.webp?tr=w-640",
    );
  });

  it("keeps local demo photos as paths so next/image can optimize them", () => {
    expect(getPublicStorageImageUrl("demo/capacete-apex.webp", 640)).toBe("/images/demo/capacete-apex.webp");
  });

  it("leaves the original URL untouched", () => {
    expect(getPublicStorageUrl("sellers/s1/a.webp")).toBe("https://ik.imagekit.io/motoshop/sellers/s1/a.webp");
  });
});
