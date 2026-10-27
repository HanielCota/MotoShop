import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

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
  // oxlint-disable-next-line nextjs/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { StorefrontNavigation } from "./storefront-navigation";

const areaAccess = vi.hoisted(() => ({ admin: false, seller: false }));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ ...areaAccess })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  areaAccess.admin = false;
  areaAccess.seller = false;
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

it("puts the Admin and Central do Lojista shortcuts on top for whoever can open them", async () => {
  areaAccess.admin = true;
  areaAccess.seller = true;
  authMocks.useSession.mockReturnValue({ data: { user: { id: "admin-seller", name: "Guilherme" } } });
  render(<StorefrontNavigation />);
  fireEvent.click(screen.getByRole("button", { name: "Minha conta" }));

  const menu = await screen.findByRole("menu");
  await within(menu).findByRole("menuitem", { name: "Painel do Admin" });
  const items = within(menu).getAllByRole("menuitem");
  expect(items.slice(0, 3).map((item) => [item.textContent, item.getAttribute("href")])).toEqual([
    ["Painel do Admin", "/admin"],
    ["Central do Lojista", "/seller"],
    ["Meus pedidos", "/orders"],
  ]);
  expect(fetch).toHaveBeenCalledWith("/api/account/area-access", expect.objectContaining({ cache: "no-store" }));
  authMocks.useSession.mockReset();
});

it("shows the shortcuts on browsers without AbortSignal.any (Safari before 17.4)", async () => {
  const originalAny = AbortSignal.any;
  Reflect.deleteProperty(AbortSignal, "any");
  areaAccess.admin = true;
  authMocks.useSession.mockReturnValue({ data: { user: { id: "old-safari-admin", name: "Renata" } } });

  try {
    render(<StorefrontNavigation />);
    fireEvent.click(screen.getByRole("button", { name: "Minha conta" }));

    const menu = await screen.findByRole("menu");
    expect(await within(menu).findByRole("menuitem", { name: "Painel do Admin" })).toHaveAttribute("href", "/admin");
  } finally {
    AbortSignal.any = originalAny;
    authMocks.useSession.mockReset();
  }
});

it("shows only the Central do Lojista to a store member", async () => {
  areaAccess.seller = true;
  authMocks.useSession.mockReturnValue({ data: { user: { id: "member", name: "Juliana" } } });
  render(<StorefrontNavigation />);
  fireEvent.click(screen.getByRole("button", { name: "Minha conta" }));

  const menu = await screen.findByRole("menu");
  expect(await within(menu).findByRole("menuitem", { name: "Central do Lojista" })).toHaveAttribute("href", "/seller");
  expect(within(menu).queryByRole("menuitem", { name: "Painel do Admin" })).not.toBeInTheDocument();
  authMocks.useSession.mockReset();
});

it("does not ask for area shortcuts while signed out", () => {
  authMocks.useSession.mockReturnValue({ data: null });
  render(<StorefrontNavigation />);
  expect(fetch).not.toHaveBeenCalled();
});

it("links visitors to the login page", () => {
  authMocks.useSession.mockReturnValue({ data: null });
  render(<StorefrontNavigation />);
  expect(screen.getByRole("link", { name: "Entrar na minha conta" })).toHaveAttribute("href", "/login");
});

it("shows neither the login link nor the account menu until the page knows who is signed in", () => {
  authMocks.useSession.mockReturnValue({ data: null, isPending: true });
  const { rerender } = render(<StorefrontNavigation />);

  expect(screen.queryByRole("link", { name: "Entrar na minha conta" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Minha conta" })).not.toBeInTheDocument();

  authMocks.useSession.mockReturnValue({ data: { user: { id: "buyer", name: "Comprador" } }, isPending: false });
  rerender(<StorefrontNavigation />);

  expect(screen.getByRole("button", { name: "Minha conta" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Entrar na minha conta" })).not.toBeInTheDocument();
});

it("keeps the visitor's login link while the session is checked again on returning to the tab", () => {
  authMocks.useSession.mockReturnValue({ data: null, isPending: false });
  const { rerender } = render(<StorefrontNavigation />);
  expect(screen.getByRole("link", { name: "Entrar na minha conta" })).toBeInTheDocument();

  authMocks.useSession.mockReturnValue({ data: null, isPending: true });
  rerender(<StorefrontNavigation />);

  expect(screen.getByRole("link", { name: "Entrar na minha conta" })).toBeInTheDocument();
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

it("keeps the filters applied on the catalog when a new search is sent from the header", () => {
  authMocks.useSession.mockReturnValue({ data: null });
  navigation.pathname = "/products";
  navigation.search = "category=capacetes&q=fox&page=3";

  render(<StorefrontNavigation />);

  const forms = screen.getAllByRole("search", { hidden: true });
  for (const form of forms) {
    const hidden = [...form.querySelectorAll<HTMLInputElement>("input[type=hidden]")].map((input) => [
      input.name,
      input.value,
    ]);

    expect(hidden).toEqual([["category", "capacetes"]]);
  }
});

it("starts the header search empty outside the catalog", () => {
  authMocks.useSession.mockReturnValue({ data: null });
  navigation.pathname = "/products/capacete";
  navigation.search = "q=capacete";

  render(<StorefrontNavigation />);

  const fields = screen.getAllByRole("combobox", { name: "Buscar produtos", hidden: true });
  expect(fields.every((field) => (field as HTMLInputElement).value === "")).toBe(true);
});
