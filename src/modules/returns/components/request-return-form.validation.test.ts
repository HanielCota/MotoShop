import { expect, it, vi } from "vitest";

vi.mock("../actions/return-actions", () => ({ requestReturnAction: vi.fn() }));

import { submitReturnWithoutOrphanPhotos, validateReturnQuantity } from "./request-return-form";

function formWith(quantity: string) {
  const formData = new FormData();
  formData.set("quantity", quantity);
  return formData;
}

const quantityProblem = { message: "Informe uma quantidade entre 1 e 3.", field: "quantity" };

it("accepts a whole quantity up to what was bought", () => {
  expect(validateReturnQuantity(3)(formWith("2"))).toBeNull();
  expect(validateReturnQuantity(3)(formWith("3"))).toBeNull();
});

it("explains the allowed range inline instead of the browser bubble", () => {
  expect(validateReturnQuantity(3)(formWith("0"))).toEqual(quantityProblem);
  expect(validateReturnQuantity(3)(formWith("4"))).toEqual(quantityProblem);
  expect(validateReturnQuantity(3)(formWith("1.5"))).toEqual(quantityProblem);
});

it("reads the text field strictly now that it is not a native number input (DN-07)", () => {
  expect(validateReturnQuantity(3)(formWith(" 2 "))).toBeNull();
  expect(validateReturnQuantity(3)(formWith(""))).toEqual(quantityProblem);
  expect(validateReturnQuantity(3)(formWith("1e0"))).toEqual(quantityProblem);
  expect(validateReturnQuantity(3)(formWith("2,0"))).toEqual(quantityProblem);
});

it("discards the uploaded photos when sending the return fails with no answer", async () => {
  const discard = vi.fn(async () => undefined);
  const photos = [{ key: "returns/item-1/a.jpg", fileId: "file-1" }];

  const sending = submitReturnWithoutOrphanPhotos({
    target: { orderNumber: "MS-1", orderItemId: "item-1" },
    photos,
    submit: async () => Promise.reject(new Error("network down")),
    discard,
  });

  await expect(sending).rejects.toThrow("network down");
  expect(discard).toHaveBeenCalledWith({ orderNumber: "MS-1", orderItemId: "item-1" }, photos);
});
