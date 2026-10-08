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

it("commits immediately from the stepper buttons and announces errors", async () => {
  mocks.update.mockResolvedValue({ error: "A quantidade solicitada não está disponível." });
  render(<CartItemControls cartItemId="cart-item" quantity={2} productName="Capacete Apex" maxQuantity={5} />);

  fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade de Capacete Apex" }));

  expect(mocks.update).toHaveBeenCalledWith("cart-item", 3);
  expect(await screen.findByRole("alert")).toHaveTextContent("não está disponível");
  // O valor otimista volta ao do servidor quando a transição termina.
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Quantidade de Capacete Apex" })).toHaveValue("2"));
});

it("removes the item through a labelled button", async () => {
  mocks.update.mockResolvedValue({ success: "Carrinho atualizado." });
  render(<CartItemControls cartItemId="cart-item" quantity={1} productName="Capacete Apex" />);

  expect(screen.getByRole("button", { name: "Diminuir quantidade de Capacete Apex" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Remover Capacete Apex do carrinho" }));

  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("cart-item", 0));
});
