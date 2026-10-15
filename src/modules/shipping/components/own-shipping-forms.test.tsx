import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), advance: vi.fn() }));
vi.mock("../actions/own-shipping-actions", () => ({
  createOwnShippingMethodAction: mocks.create,
  setOwnShippingMethodActiveAction: vi.fn(),
  advanceOwnShipmentAction: mocks.advance,
}));

import { OwnShipmentActions, OwnShippingMethodForm } from "./own-shipping-forms";

afterEach(cleanup);

it("checks the delivery method in the browser before calling the server (BUG-011)", async () => {
  render(<OwnShippingMethodForm />);

  fireEvent.change(screen.getByLabelText("Nome da entrega"), { target: { value: "ab" } });
  fireEvent.click(screen.getByRole("button", { name: /Criar modalidade/ }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Use pelo menos 3 caracteres no nome da entrega.");
  expect(mocks.create).not.toHaveBeenCalled();
});

it("asks before marking an own shipment as shipped (BUG-004)", async () => {
  mocks.advance.mockResolvedValue({ success: "Envio atualizado." });
  render(<OwnShipmentActions sellerOrderId="cmf8w8m4p0000s6o5zj2q8v3k" canShip canDeliver={false} />);

  fireEvent.click(screen.getByRole("button", { name: "Confirmar envio próprio" }));
  expect(await screen.findByText("Confirmar que o pedido foi despachado?")).toBeInTheDocument();
  expect(mocks.advance).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Confirmar envio" }));

  expect(await screen.findByText("Envio atualizado.")).toBeInTheDocument();
  expect(mocks.advance).toHaveBeenCalledOnce();
});
