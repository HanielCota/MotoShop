import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  clear: vi.fn(),
  preview: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../actions/cart-actions", () => ({
  clearCartAction: actions.clear,
  getCartPreviewAction: actions.preview,
  updateCartItemAction: actions.update,
}));
vi.mock("next/link", () => ({
  default: ({ href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props} />,
}));

import { CartPreview } from "./cart-preview";

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("opens a cart summary and links to the full cart", async () => {
  actions.preview.mockResolvedValue({
    items: [
      {
        id: "item-1",
        name: "Capacete off-road",
        variant: "Preto · M",
        quantity: 2,
        availableQuantity: 5,
        unitPriceInCents: 15000,
      },
    ],
    itemCount: 2,
    subtotalInCents: 30000,
    paymentAvailable: true,
  });
  render(<CartPreview />);

  fireEvent.click(screen.getByRole("button", { name: "Visualizar carrinho" }));

  expect(await screen.findByText("Capacete off-road")).toBeInTheDocument();
  expect(screen.getByText("Subtotal").parentElement?.querySelector("strong")).toHaveTextContent("300,00");
  expect(screen.getByRole("link", { name: "Ver carrinho" })).toHaveAttribute("href", "/cart");
  expect(screen.getByRole("link", { name: "Finalizar compra" })).toHaveAttribute("href", "/checkout");
  expect(screen.queryByText("Pagamento ainda não liberado")).not.toBeInTheDocument();
});

it("offers to review shipping instead of finishing the purchase while payment is unavailable", async () => {
  actions.preview.mockResolvedValue({
    items: [
      {
        id: "item-1",
        name: "Capacete off-road",
        variant: "Preto · M",
        quantity: 1,
        availableQuantity: 5,
        unitPriceInCents: 15000,
      },
    ],
    itemCount: 1,
    subtotalInCents: 15000,
    paymentAvailable: false,
  });
  render(<CartPreview />);

  fireEvent.click(screen.getByRole("button", { name: "Visualizar carrinho" }));

  expect(await screen.findByText("Pagamento ainda não liberado")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Conferir frete" })).toHaveAttribute("href", "/checkout");
  expect(screen.queryByRole("link", { name: "Finalizar compra" })).not.toBeInTheDocument();
});

it("lets the customer remove an item from the preview", async () => {
  const item = {
    id: "item-1",
    name: "Capacete off-road",
    variant: "Preto · M",
    quantity: 1,
    availableQuantity: 5,
    unitPriceInCents: 15000,
  };
  actions.preview.mockResolvedValueOnce({ items: [item], itemCount: 1, subtotalInCents: 15000 });
  actions.preview.mockResolvedValueOnce({ items: [], itemCount: 0, subtotalInCents: 0 });
  actions.update.mockResolvedValue({ success: "Carrinho atualizado." });
  render(<CartPreview />);

  fireEvent.click(screen.getByRole("button", { name: "Visualizar carrinho" }));
  expect(await screen.findByText("Capacete off-road")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remover Capacete off-road do carrinho" }));
  await waitFor(() => expect(actions.update).toHaveBeenCalledWith("item-1", 0));
  expect(await screen.findByText("Seu carrinho está vazio")).toBeInTheDocument();
});

it("lets the customer empty the whole cart from the preview", async () => {
  actions.preview.mockResolvedValue({
    items: [
      {
        id: "item-1",
        name: "Capacete off-road",
        variant: "Preto · M",
        quantity: 1,
        availableQuantity: 5,
        unitPriceInCents: 15000,
      },
    ],
    itemCount: 1,
    subtotalInCents: 15000,
  });
  actions.clear.mockResolvedValue({ success: "Carrinho limpo." });
  render(<CartPreview />);

  fireEvent.click(screen.getByRole("button", { name: "Visualizar carrinho" }));
  expect(await screen.findByText("Capacete off-road")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Limpar carrinho" }));
  fireEvent.click(screen.getByRole("button", { name: "Manter itens" }));
  expect(screen.queryByRole("button", { name: "Sim, limpar" })).not.toBeInTheDocument();
  expect(screen.getByText("Capacete off-road")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Limpar carrinho" }));
  expect(actions.clear).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Sim, limpar" }));

  await waitFor(() => expect(actions.clear).toHaveBeenCalledOnce());
  expect(await screen.findByText("Carrinho limpo.")).toBeInTheDocument();
  expect(screen.getByText("Seu carrinho está vazio")).toBeInTheDocument();
});

it("updates quantity from the preview and prevents exceeding available stock", async () => {
  const item = {
    id: "item-1",
    name: "Capacete off-road",
    variant: "Preto · M",
    quantity: 2,
    availableQuantity: 2,
    unitPriceInCents: 15000,
  };
  actions.preview.mockResolvedValueOnce({ items: [item], itemCount: 2, subtotalInCents: 30000 });
  actions.preview.mockResolvedValueOnce({ items: [{ ...item, quantity: 1 }], itemCount: 1, subtotalInCents: 15000 });
  actions.update.mockResolvedValue({ success: "Carrinho atualizado." });
  render(<CartPreview />);

  fireEvent.click(screen.getByRole("button", { name: "Visualizar carrinho" }));
  expect(await screen.findByText("Capacete off-road")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Aumentar quantidade de Capacete off-road" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Diminuir quantidade de Capacete off-road" }));
  await waitFor(() => expect(actions.update).toHaveBeenCalledWith("item-1", 1));
});
