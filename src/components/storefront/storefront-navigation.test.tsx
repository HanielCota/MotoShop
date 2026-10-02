import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/products" }));
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

afterEach(cleanup);

it("uses both complete logo variants for the hover transition", () => {
  authMocks.useSession.mockReturnValue({ data: null });
  render(<StorefrontNavigation />);

  const brand = screen.getByRole("link", { name: "O Moto Shop, página inicial" });
  expect(Array.from(brand.querySelectorAll("img"), (image) => image.getAttribute("src"))).toEqual([
    "/Banner2.png",
    "/Banner1.png",
  ]);
});

it("links signed-in customers to their order history", () => {
  authMocks.useSession.mockReturnValue({ data: { user: { id: "buyer", name: "Comprador" } } });
  render(<StorefrontNavigation />);
  expect(screen.getByRole("link", { name: "Minha conta e pedidos" })).toHaveAttribute("href", "/orders");
  expect(screen.queryByRole("link", { name: "Compatibilidade" })).not.toBeInTheDocument();
  authMocks.useSession.mockReset();
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
