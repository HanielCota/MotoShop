import { expect, it, vi } from "vitest";

vi.mock("../actions/return-actions", () => ({ requestReturnAction: vi.fn() }));

import { validateReturnQuantity } from "./request-return-form";

function formWith(quantity: string) {
  const formData = new FormData();
  formData.set("quantity", quantity);
  return formData;
}

it("accepts a whole quantity up to what was bought", () => {
  expect(validateReturnQuantity(3)(formWith("2"))).toBeNull();
  expect(validateReturnQuantity(3)(formWith("3"))).toBeNull();
});

it("explains the allowed range inline instead of the browser bubble", () => {
  expect(validateReturnQuantity(3)(formWith("0"))).toBe("Informe uma quantidade entre 1 e 3.");
  expect(validateReturnQuantity(3)(formWith("4"))).toBe("Informe uma quantidade entre 1 e 3.");
  expect(validateReturnQuantity(3)(formWith("1.5"))).toBe("Informe uma quantidade entre 1 e 3.");
});
