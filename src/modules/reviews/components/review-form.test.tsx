import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/modules/reviews/actions/review-actions", () => ({
  createReviewAction: vi.fn(),
  createReviewUploadUrlAction: vi.fn(),
  removeReviewUploadAction: vi.fn(),
}));
vi.mock("@/shared/storage/upload-image", () => ({ uploadFileToImageKit: vi.fn() }));

import { ReviewForm } from "./review-form";
import { uploadFileToImageKit } from "@/shared/storage/upload-image";

afterEach(cleanup);

it("accepts product review scores in tenths and stages media until the review is submitted", async () => {
  render(<ReviewForm orderItemId="cm123456789012345678901234" sellerAlreadyReviewed={false} />);

  fireEvent.change(screen.getByRole("slider", { name: /Nota do produto/ }), { target: { value: "43" } });

  expect(
    screen.getByText((_, element) => element?.tagName === "OUTPUT" && element.textContent?.includes("4,3/5") === true),
  ).toBeInTheDocument();
  expect(document.querySelector('input[name="productRatingTenths"]')).toHaveValue("43");
  expect(screen.getByRole("combobox", { name: "Nota do lojista" })).toBeInTheDocument();
  const fileInput = screen.getByLabelText("Fotos e vídeos (opcional, até 3 arquivos)");
  expect(fileInput).toHaveAttribute("type", "file");
  fireEvent.change(fileInput, { target: { files: [new File(["image"], "foto.jpg", { type: "image/jpeg" })] } });
  expect(await screen.findByText("foto.jpg")).toBeInTheDocument();
  expect(uploadFileToImageKit).not.toHaveBeenCalled();
});
