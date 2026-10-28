import { afterEach, expect, it, vi } from "vitest";

import {
  IMAGE_SERVICE_REFUSED_MESSAGE,
  IMAGE_SERVICE_UNREACHABLE_MESSAGE,
  findImageFileProblem,
  uploadFileToImageKit,
} from "./upload-image";

const FIVE_MEGABYTES = 5 * 1024 * 1024;

function image(type: string, size: number, name = "foto.png") {
  return new File([new Uint8Array(size)], name, { type });
}

afterEach(() => vi.unstubAllGlobals());

it.each(["image/jpeg", "image/png", "image/webp"])("accepts a %s image of up to 5 MB", (type) => {
  expect(findImageFileProblem(image(type, FIVE_MEGABYTES))).toBeNull();
});

it("names the file that is another type or over 5 MB", () => {
  expect(findImageFileProblem(image("image/gif", 1024, "anim.gif"))).toBe(
    'A imagem "anim.gif" precisa ser JPG, PNG ou WebP e ter até 5 MB.',
  );
  expect(findImageFileProblem(image("image/png", FIVE_MEGABYTES + 1, "grande.png"))).toBe(
    'A imagem "grande.png" precisa ser JPG, PNG ou WebP e ter até 5 MB.',
  );
});

it("does not blame the file when the image service refuses the upload", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));

  await expect(
    uploadFileToImageKit({ url: "https://upload.example.test", fields: {}, file: image("image/png", 1024) }),
  ).rejects.toThrow(IMAGE_SERVICE_REFUSED_MESSAGE);
});

it("explains a network failure in Portuguese instead of the browser's raw error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

  await expect(
    uploadFileToImageKit({ url: "https://upload.example.test", fields: {}, file: image("image/png", 1024) }),
  ).rejects.toThrow(IMAGE_SERVICE_UNREACHABLE_MESSAGE);
});
