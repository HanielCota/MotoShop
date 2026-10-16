import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

import { CartPreview, cartTriggerLabel } from "./cart-preview";

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

  fireEvent.click(screen.getByRole("button", { name: /^Carrinho,/ }));

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

  fireEvent.click(screen.getByRole("button", { name: /^Carrinho,/ }));

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

  fireEvent.click(screen.getByRole("button", { name: /^Carrinho,/ }));
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

  fireEvent.click(screen.getByRole("button", { name: /^Carrinho,/ }));
  expect(await screen.findByText("Capacete off-road")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Limpar carrinho" }));
  const firstDialog = await screen.findByRole("alertdialog", { name: "Limpar carrinho?" });
  expect(firstDialog).toHaveTextContent("O item sai do carrinho.");
  fireEvent.click(within(firstDialog).getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(screen.getByText("Capacete off-road")).toBeInTheDocument();
  expect(actions.clear).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Limpar carrinho" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Limpar carrinho" }));

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

  fireEvent.click(screen.getByRole("button", { name: /^Carrinho,/ }));
  expect(await screen.findByText("Capacete off-road")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Aumentar quantidade de Capacete off-road" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Diminuir quantidade de Capacete off-road" }));
  await waitFor(() => expect(actions.update).toHaveBeenCalledWith("item-1", 1));
});

it("shows a retry instead of an endless loading message when the cart cannot be read", async () => {
  actions.preview.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({
    items: [],
    itemCount: 0,
    subtotalInCents: 0,
    paymentAvailable: false,
  });
  render(<CartPreview />);

  fireEvent.click(screen.getByRole("button", { name: /^Carrinho,/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar o carrinho.");
  expect(screen.queryByText("Carregando carrinho…")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ir para o carrinho" })).toHaveAttribute("href", "/cart");

  fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
  expect(await screen.findByText("Seu carrinho está vazio")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("reads the item count in the cart button name (IC-11)", () => {
  expect(cartTriggerLabel(0)).toBe("Carrinho, vazio");
  expect(cartTriggerLabel(1)).toBe("Carrinho, 1 item");
  expect(cartTriggerLabel(3)).toBe("Carrinho, 3 itens");
});
