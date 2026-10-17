import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/products", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: vi.fn() }),
}));
const authMocks = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/cart/actions/cart-actions", () => ({
  getCartPreviewAction: vi.fn(async () => ({ items: [], itemCount: 0, subtotalInCents: 0 })),
  clearCartAction: vi.fn(),
  updateCartItemAction: vi.fn(),
}));
vi.mock("@/modules/auth/infrastructure/auth-client", () => ({
  authClient: { useSession: authMocks.useSession },
}));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { StorefrontNavigation } from "./storefront-navigation";

afterEach(() => {
  cleanup();
  navigation.pathname = "/products";
  navigation.search = "";
});

it("renders the same header on the homepage with a single seller link label", () => {
  navigation.pathname = "/";
  authMocks.useSession.mockReturnValue({ data: null });
  render(<StorefrontNavigation />);
  expect(screen.getByRole("banner")).toBeInTheDocument();
  const sellerLinks = screen.getAllByRole("link", { name: "Venda no Moto Shop" });
  expect(sellerLinks.length).toBeGreaterThan(0);
  expect(sellerLinks.every((link) => link.getAttribute("href") === "/seller")).toBe(true);
  expect(screen.queryByRole("link", { name: "Para lojistas" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Quero vender" })).not.toBeInTheDocument();
});

it("stays out of the seller and admin areas", () => {
  authMocks.useSession.mockReturnValue({ data: null });
  for (const pathname of ["/seller", "/seller/orders", "/admin"]) {
    navigation.pathname = pathname;
    const { container } = render(<StorefrontNavigation />);
    expect(container).toBeEmptyDOMElement();
    cleanup();
  }
});

it("uses both horizontal logo variants for the hover transition", () => {
  authMocks.useSession.mockReturnValue({ data: null });
  render(<StorefrontNavigation />);

  const brand = screen.getByRole("link", { name: "O Moto Shop, página inicial" });
  expect(Array.from(brand.querySelectorAll("img"), (image) => image.getAttribute("src"))).toEqual([
    "/brand/logo-horizontal-dark.webp",
    "/brand/logo-horizontal-orange.webp",
  ]);
});

it("gives signed-in customers an account menu with their shortcuts", async () => {
  authMocks.useSession.mockReturnValue({ data: { user: { id: "buyer", name: "Comprador" } } });
  render(<StorefrontNavigation />);
  const trigger = screen.getByRole("button", { name: "Minha conta" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  const menu = await screen.findByRole("menu");
  const items = within(menu).getAllByRole("menuitem");
  expect(items.map((item) => [item.textContent, item.getAttribute("href")])).toEqual([
    ["Meus pedidos", "/orders"],
    ["Favoritos", "/favorites"],
    ["Dados cadastrais", "/account/profile"],
    ["Alterar senha", "/account/password"],
    ["Meus endereços", "/account/addresses"],
    ["Sair", null],
  ]);
  fireEvent.keyDown(items[0] as HTMLElement, { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  await waitFor(() => expect(trigger).toHaveFocus());
  authMocks.useSession.mockReset();
});

it("links visitors to the login page", () => {
  authMocks.useSession.mockReturnValue({ data: null });
  render(<StorefrontNavigation />);
  expect(screen.getByRole("link", { name: "Entrar na minha conta" })).toHaveAttribute("href", "/login");
});

it("closes the mobile navigation with Escape and restores trigger focus", () => {
  authMocks.useSession.mockReturnValue({ data: null });
  render(<StorefrontNavigation />);
  const trigger = screen.getByRole("button", { name: "Abrir menu" });
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  const menu = screen.getByRole("navigation", { name: "Navegação mobile" });
  expect(menu).not.toHaveAttribute("hidden");

  fireEvent.keyDown(menu, { key: "Escape" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveFocus();
  expect(menu).toHaveAttribute("hidden");
});

it("keeps the header search on the catalog, filled with the current search", () => {
  authMocks.useSession.mockReturnValue({ data: null });
  navigation.pathname = "/products";
  navigation.search = "q=capacete";

  render(<StorefrontNavigation />);

  const fields = screen.getAllByRole("combobox", { name: "Buscar produtos", hidden: true });
  expect(fields.length).toBeGreaterThan(0);
  expect(fields.every((field) => (field as HTMLInputElement).value === "capacete")).toBe(true);
});

it("starts the header search empty outside the catalog", () => {
  authMocks.useSession.mockReturnValue({ data: null });
  navigation.pathname = "/products/capacete";
  navigation.search = "q=capacete";

  render(<StorefrontNavigation />);

  const fields = screen.getAllByRole("combobox", { name: "Buscar produtos", hidden: true });
  expect(fields.every((field) => (field as HTMLInputElement).value === "")).toBe(true);
});
