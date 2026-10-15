import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/products" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ push: vi.fn() }) }));
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

it("gives signed-in customers an account menu with their shortcuts", () => {
  authMocks.useSession.mockReturnValue({ data: { user: { id: "buyer", name: "Comprador" } } });
  render(<StorefrontNavigation />);
  const trigger = screen.getByRole("button", { name: "Minha conta" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("link", { name: "Meus pedidos" })).toHaveAttribute("href", "/orders");
  expect(screen.getByRole("link", { name: "Favoritos" })).toHaveAttribute("href", "/favorites");
  expect(screen.getByRole("link", { name: "Dados cadastrais" })).toHaveAttribute("href", "/account/profile");
  expect(screen.getByRole("link", { name: "Redefinir senha" })).toHaveAttribute("href", "/account/password");
  expect(screen.getByRole("link", { name: "Meus endereços" })).toHaveAttribute("href", "/account/addresses");
  fireEvent.keyDown(screen.getByRole("link", { name: "Meus pedidos" }), { key: "Escape" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("link", { name: "Compatibilidade" })).not.toBeInTheDocument();
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

it("hides the header search only on the catalog page, which has its own search band", () => {
  authMocks.useSession.mockReturnValue({ data: null });

  navigation.pathname = "/products";
  const { unmount } = render(<StorefrontNavigation />);
  expect(screen.queryAllByRole("combobox", { name: "Buscar produtos" })).toHaveLength(0);
  unmount();

  navigation.pathname = "/products/capacete";
  render(<StorefrontNavigation />);
  expect(screen.getAllByRole("combobox", { name: "Buscar produtos", hidden: true }).length).toBeGreaterThan(0);
});
