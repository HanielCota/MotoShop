import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/modules/reviews/actions/review-actions", () => ({
  createReviewAction: vi.fn(),
  createReviewUploadUrlAction: vi.fn(),
  removeReviewUploadAction: vi.fn(),
}));
vi.mock("@/shared/storage/upload-image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/storage/upload-image")>()),
  uploadFileToImageKit: vi.fn(),
}));

import { ReviewForm } from "./review-form";
import { uploadFileToImageKit } from "@/shared/storage/upload-image";

afterEach(cleanup);

it("rates product and store with whole stars and stages photos until the review is submitted", async () => {
  render(<ReviewForm orderItemId="cm123456789012345678901234" sellerAlreadyReviewed={false} />);

  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  const product = screen.getByRole("radiogroup", { name: "Nota do produto" });
  fireEvent.click(within(product).getByRole("radio", { name: "4 estrelas" }));
  expect(document.querySelector(`input[name="productRatingTenths"]`)).toHaveValue("40");
  const store = screen.getByRole("radiogroup", { name: "Nota da loja" });
  fireEvent.click(within(store).getByRole("radio", { name: "3 estrelas" }));
  expect(document.querySelector(`input[name="sellerRating"]`)).toHaveValue("3");

  const fileInput = screen.getByLabelText("Fotos (opcional, até 3 imagens)");
  expect(fileInput).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  fireEvent.change(fileInput, { target: { files: [new File(["image"], "foto.jpg", { type: "image/jpeg" })] } });
  expect(await screen.findByText("foto.jpg")).toBeInTheDocument();
  expect(uploadFileToImageKit).not.toHaveBeenCalled();
});

it("refuses videos, which are out of scope for reviews", async () => {
  render(<ReviewForm orderItemId="cm123456789012345678901234" sellerAlreadyReviewed />);

  expect(screen.queryByRole("radiogroup", { name: "Nota da loja" })).not.toBeInTheDocument();
  const fileInput = screen.getByLabelText("Fotos (opcional, até 3 imagens)");
  fireEvent.change(fileInput, { target: { files: [new File(["video"], "video.mp4", { type: "video/mp4" })] } });
  expect(
    await screen.findByText('A imagem "video.mp4" precisa ser JPG, PNG ou WebP e ter até 5 MB.'),
  ).toBeInTheDocument();
});
