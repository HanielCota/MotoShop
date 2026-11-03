import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

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
const authMocks = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/auth/infrastructure/auth-client", () => ({
  authClient: { useSession: authMocks.useSession },
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props} />,
}));

import { CartPreview, cartTriggerLabel } from "./cart-preview";

beforeEach(() => {
  authMocks.useSession.mockReturnValue({ data: null });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("shows the item count on the cart button as soon as the page opens, without opening the summary", async () => {
  actions.preview.mockResolvedValue({ items: [], itemCount: 8, subtotalInCents: 120000 });

  render(<CartPreview />);

  expect(await screen.findByRole("button", { name: "Carrinho, 8 itens" })).toHaveTextContent("8");
  expect(actions.preview).toHaveBeenCalledOnce();
});

it("reads the count again when the customer signs in, since the cart changes owner", async () => {
  actions.preview.mockResolvedValueOnce({ items: [], itemCount: 1, subtotalInCents: 15000 });
  actions.preview.mockResolvedValueOnce({ items: [], itemCount: 3, subtotalInCents: 45000 });
  const { rerender } = render(<CartPreview />);
  expect(await screen.findByRole("button", { name: "Carrinho, 1 item" })).toBeInTheDocument();

  authMocks.useSession.mockReturnValue({ data: { user: { id: "buyer" } } });
  rerender(<CartPreview />);

  expect(await screen.findByRole("button", { name: "Carrinho, 3 itens" })).toBeInTheDocument();
  expect(actions.preview).toHaveBeenCalledTimes(2);
});

it("reads the cart once per page for a signed-in customer, after the session answers", async () => {
  actions.preview.mockResolvedValue({ items: [], itemCount: 2, subtotalInCents: 30000 });
  authMocks.useSession.mockReturnValue({ data: null, isPending: true });
  const { rerender } = render(<CartPreview />);
  expect(actions.preview).not.toHaveBeenCalled();

  authMocks.useSession.mockReturnValue({ data: { user: { id: "buyer" } }, isPending: false });
  rerender(<CartPreview />);

  expect(await screen.findByRole("button", { name: "Carrinho, 2 itens" })).toBeInTheDocument();
  expect(actions.preview).toHaveBeenCalledOnce();
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
  });
  render(<CartPreview />);

  fireEvent.click(screen.getByRole("button", { name: /^Carrinho,/ }));

  expect(await screen.findByText("Capacete off-road")).toBeInTheDocument();
  expect(screen.getByText("Subtotal").parentElement?.querySelector("strong")).toHaveTextContent("300,00");
  expect(screen.getByRole("link", { name: "Ver carrinho" })).toHaveAttribute("href", "/cart");
  expect(screen.getByRole("link", { name: "Finalizar compra" })).toHaveAttribute("href", "/checkout");
  expect(screen.queryByText("Pagamento ainda não liberado")).not.toBeInTheDocument();
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
  // The first read is the badge count on page load; the second, opening the summary.
  actions.preview.mockResolvedValueOnce({ items: [item], itemCount: 1, subtotalInCents: 15000 });
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
  actions.preview
    .mockResolvedValueOnce({ items: [], itemCount: 0, subtotalInCents: 0 })
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({
      items: [],
      itemCount: 0,
      subtotalInCents: 0,
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

it("shows each item's product photo, and the cart page placeholder when there is none", async () => {
  const item = {
    variant: "Preto · M",
    quantity: 1,
    availableQuantity: 5,
    unitPriceInCents: 15000,
  };
  actions.preview.mockResolvedValue({
    items: [
      { ...item, id: "item-1", name: "Capacete off-road", thumbnailUrl: "https://ik.example/capacete.jpg" },
      { ...item, id: "item-2", name: "Bota trilha", thumbnailUrl: null },
      { ...item, id: "item-3", name: "Luva leve", thumbnailUrl: "https://ik.example/luva.jpg" },
    ],
    itemCount: 3,
    subtotalInCents: 45000,
  });
  render(<CartPreview />);

  fireEvent.click(screen.getByRole("button", { name: /^Carrinho,/ }));
  const list = await screen.findByRole("list", { name: "Itens no carrinho" });
  const thumbnails = within(list).getAllByTestId("cart-item-thumbnail");

  expect(thumbnails).toHaveLength(3);
  expect(thumbnails[0]?.querySelector("img")).toHaveAttribute("src", "https://ik.example/capacete.jpg");
  expect(thumbnails[1]?.querySelector("img")).toBeNull();
  expect(thumbnails[2]?.querySelector("img")).toHaveAttribute("src", "https://ik.example/luva.jpg");
});
