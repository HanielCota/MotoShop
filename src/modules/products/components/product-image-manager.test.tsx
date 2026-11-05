import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/modules/products/actions/product-image-actions", () => ({
  attachProductImageAction: vi.fn(),
  createProductImageUploadUrlAction: vi.fn(),
  discardProductImageUploadAction: vi.fn(),
  removeProductImageAction: vi.fn(),
  reorderProductImagesAction: vi.fn(),
}));

import { createProductImageUploadUrlAction } from "@/modules/products/actions/product-image-actions";

import { ProductImageManager } from "./product-image-manager";

const FIVE_MEGABYTES = 5 * 1024 * 1024;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fileInputOf(container: HTMLElement) {
  const fileInput = container.querySelector('input[type="file"]');
  if (fileInput == null) throw new Error("Expected the product image file input");
  return fileInput;
}

// Regression: the files were checked one by one inside the upload loop, so a GIF picked third
// was refused only after the first two had been uploaded.
it("checks every selected file before uploading any of them", async () => {
  const { container } = render(
    <ProductImageManager productId="product-1" initialImages={[]} maxImages={8} maxSizeInBytes={FIVE_MEGABYTES} />,
  );
  const fileInput = container.querySelector('input[type="file"]');
  if (fileInput == null) throw new Error("Expected the product image file input");

  const photo = new File(["image"], "capa.png", { type: "image/png" });
  const animation = new File(["image"], "anim.gif", { type: "image/gif" });
  fireEvent.change(fileInput, { target: { files: [photo, animation] } });

  expect(
    await screen.findByText('A imagem "anim.gif" precisa ser JPG, PNG ou WebP e ter até 5 MB.'),
  ).toBeInTheDocument();
  expect(createProductImageUploadUrlAction).not.toHaveBeenCalled();
});

// Regression guard: passing the checker straight to Array.map would hand each file's index in as
// the size limit, refusing every photo after the first.
it("checks every file against the configured size, not against its position in the selection", async () => {
  vi.mocked(createProductImageUploadUrlAction).mockResolvedValue({ error: "stop here" });
  const { container } = render(
    <ProductImageManager productId="product-1" initialImages={[]} maxImages={8} maxSizeInBytes={FIVE_MEGABYTES} />,
  );

  const photos = [
    new File(["first"], "a.png", { type: "image/png" }),
    new File(["second"], "b.png", { type: "image/png" }),
  ];
  fireEvent.change(fileInputOf(container), { target: { files: photos } });

  expect(await screen.findByText("stop here")).toBeInTheDocument();
  expect(createProductImageUploadUrlAction).toHaveBeenCalled();
});

it("follows the photo count configured in the Admin", async () => {
  const { container } = render(
    <ProductImageManager productId="product-1" initialImages={[]} maxImages={2} maxSizeInBytes={FIVE_MEGABYTES} />,
  );

  const photos = ["a", "b", "c"].map((name) => new File(["x"], `${name}.png`, { type: "image/png" }));
  fireEvent.change(fileInputOf(container), { target: { files: photos } });

  expect(await screen.findByText("Você pode adicionar mais 2 imagens a este produto.")).toBeInTheDocument();
  expect(screen.getByText(/Até 2 imagens JPG, PNG ou WebP, com no máximo 5 MB cada\./)).toBeInTheDocument();
  expect(createProductImageUploadUrlAction).not.toHaveBeenCalled();
});
