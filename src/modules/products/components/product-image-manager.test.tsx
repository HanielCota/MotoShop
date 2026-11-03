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

afterEach(cleanup);

// Regression: the files were checked one by one inside the upload loop, so a GIF picked third
// was refused only after the first two had been uploaded.
it("checks every selected file before uploading any of them", async () => {
  const { container } = render(<ProductImageManager productId="product-1" initialImages={[]} />);
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
