import { afterEach, expect, it, vi } from "vitest";

import {
  IMAGE_FILE_RULES_MESSAGE,
  IMAGE_SERVICE_REFUSED_MESSAGE,
  imageFileProblem,
  uploadFileToImageKit,
} from "./upload-image";

const FIVE_MEGABYTES = 5 * 1024 * 1024;

function image(type: string, size: number) {
  return new File([new Uint8Array(size)], "foto", { type });
}

afterEach(() => vi.unstubAllGlobals());

it.each(["image/jpeg", "image/png", "image/webp"])("accepts a %s image of up to 5 MB", (type) => {
  expect(imageFileProblem(image(type, FIVE_MEGABYTES))).toBeNull();
});

it("explains the rules for another type or a file over 5 MB", () => {
  expect(imageFileProblem(image("image/gif", 1024))).toBe(IMAGE_FILE_RULES_MESSAGE);
  expect(imageFileProblem(image("image/png", FIVE_MEGABYTES + 1))).toBe(IMAGE_FILE_RULES_MESSAGE);
});

it("does not blame the file when the image service refuses the upload", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));

  await expect(
    uploadFileToImageKit({ url: "https://upload.example.test", fields: {}, file: image("image/png", 1024) }),
  ).rejects.toThrow(IMAGE_SERVICE_REFUSED_MESSAGE);
});
