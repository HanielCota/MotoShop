import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../actions/cart-actions", () => ({ updateCartItemAction: mocks.update }));

import { CartItemControls } from "./cart-item-controls";

afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

it("restores the server quantity when an inventory update is rejected", async () => {
  mocks.update.mockResolvedValue({ error: "A quantidade solicitada não está disponível." });
  render(<CartItemControls cartItemId="cart-item" quantity={2} />);

  const input = screen.getByRole("textbox", { name: "Quantidade" });
  fireEvent.change(input, { target: { value: "4" } });
  fireEvent.blur(input);

  await waitFor(() => expect(input).toHaveValue("2"));
  expect(screen.getByText("A quantidade solicitada não está disponível.")).toBeInTheDocument();
});

it("does not interpret an empty quantity as a request to delete the item", () => {
  render(<CartItemControls cartItemId="cart-item" quantity={2} />);
  const input = screen.getByRole("textbox", { name: "Quantidade" });
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.blur(input);

  expect(input).toHaveValue("2");
  expect(mocks.update).not.toHaveBeenCalled();
});
