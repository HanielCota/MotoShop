import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestReturnAction: vi.fn(),
  createReturnPhotoUploadAction: vi.fn(),
  removeReturnPhotoUploadAction: vi.fn(),
  uploadFileToImageKit: vi.fn(),
}));
vi.mock("../actions/return-actions", () => ({
  requestReturnAction: mocks.requestReturnAction,
  createReturnPhotoUploadAction: mocks.createReturnPhotoUploadAction,
  removeReturnPhotoUploadAction: mocks.removeReturnPhotoUploadAction,
}));
vi.mock("@/shared/storage/upload-image", () => ({ uploadFileToImageKit: mocks.uploadFileToImageKit }));

import { RequestReturnForm } from "./request-return-form";

const createObjectURL = vi.fn((file: File) => `blob:preview/${file.name}`);
const revokeObjectURL = vi.fn();

beforeEach(() => {
  Object.assign(URL, { createObjectURL, revokeObjectURL });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function choosePhotos(...names: string[]) {
  const files = names.map((name) => new File([new Uint8Array(8)], name, { type: "image/jpeg" }));
  const input = document.querySelector("input[type=file]");
  if (input == null) throw new Error("photo input not found");
  fireEvent.change(input, { target: { files } });
}

function previewSources() {
  const list = screen.queryByRole("list", { name: "Fotos anexadas" });
  return [...(list?.querySelectorAll("img") ?? [])].map((image) => image.getAttribute("src"));
}

function renderForm() {
  render(<RequestReturnForm orderNumber="MS-1" orderItemId="item-1" maxQuantity={1} idempotencyKey="key-1" />);
}

it("shows a local preview of each chosen photo without sending anything", () => {
  renderForm();
  choosePhotos("risco.jpg", "caixa.jpg");

  expect(previewSources()).toEqual(["blob:preview/risco.jpg", "blob:preview/caixa.jpg"]);
  expect(screen.getByText("risco.jpg")).toBeInTheDocument();
  expect(mocks.createReturnPhotoUploadAction).not.toHaveBeenCalled();
  expect(mocks.uploadFileToImageKit).not.toHaveBeenCalled();
});

it("frees the preview memory when a photo is removed", () => {
  renderForm();
  choosePhotos("risco.jpg", "caixa.jpg");

  fireEvent.click(screen.getByRole("button", { name: "Remover risco.jpg" }));

  expect(previewSources()).toEqual(["blob:preview/caixa.jpg"]);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview/risco.jpg");
  // Every preview URL ever created is either still on screen or already freed.
  expect(createObjectURL.mock.calls.length - revokeObjectURL.mock.calls.length).toBe(previewSources().length);
});

it("frees every preview once the return is sent", async () => {
  mocks.createReturnPhotoUploadAction.mockResolvedValue({
    key: "returns/item-1/a.jpg",
    url: "https://upload",
    fields: {},
  });
  mocks.uploadFileToImageKit.mockResolvedValue("file-a");
  mocks.requestReturnAction.mockResolvedValue({ success: "Devolução solicitada.", result: { returnRequestId: "r1" } });
  renderForm();
  choosePhotos("risco.jpg");

  fireEvent.click(screen.getByRole("button", { name: "Solicitar devolução" }));

  await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview/risco.jpg"));
  expect(previewSources()).toEqual([]);
  expect(mocks.uploadFileToImageKit).toHaveBeenCalledOnce();
});
