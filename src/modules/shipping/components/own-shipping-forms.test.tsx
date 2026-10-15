import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../actions/own-shipping-actions", () => ({
  createOwnShippingMethodAction: mocks.create,
  setOwnShippingMethodActiveAction: vi.fn(),
  advanceOwnShipmentAction: vi.fn(),
}));

import { OwnShippingMethodForm } from "./own-shipping-forms";

afterEach(cleanup);

it("checks the delivery method in the browser before calling the server (BUG-011)", async () => {
  render(<OwnShippingMethodForm />);

  fireEvent.change(screen.getByLabelText("Nome da entrega"), { target: { value: "ab" } });
  fireEvent.click(screen.getByRole("button", { name: /Criar modalidade/ }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Use pelo menos 3 caracteres no nome da entrega.");
  expect(mocks.create).not.toHaveBeenCalled();
});
