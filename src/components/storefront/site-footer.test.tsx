import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
const auth = vi.hoisted(() => ({ session: null as { user: { id: string } } | null }));
vi.mock("@/modules/auth/infrastructure/auth-client", () => ({
  authClient: { useSession: () => ({ data: auth.session }) },
}));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { SiteFooter } from "./site-footer";
import { StorefrontOnly } from "./storefront-only";

afterEach(() => {
  cleanup();
  auth.session = null;
});

function renderFooter() {
  return render(
    <StorefrontOnly>
      <SiteFooter />
    </StorefrontOnly>,
  );
}

it("renders the shared footer on storefront routes with the client's sections", () => {
  navigation.pathname = "/products";
  renderFooter();
  const footer = within(screen.getByRole("contentinfo"));

  for (const [name, href] of [
    ["Comprar", "/products"],
    ["Venda no Moto Shop", "/seller"],
    ["Pedidos", "/orders"],
    ["Entrar", "/login"],
  ] as const)
    expect(footer.getAllByRole("link", { name })[0]).toHaveAttribute("href", href);
  // One label for selling everywhere: the shortcut and the institutional link share it.
  expect(footer.getAllByRole("link", { name: "Venda no Moto Shop" })).toHaveLength(2);
  expect(footer.getByRole("heading", { name: "Horário de atendimento" })).toBeInTheDocument();
  expect(footer.getByText("Segunda a Sexta")).toBeInTheDocument();
  expect(footer.getByText(/O Moto Shop Brasil é uma plataforma e-commerce/)).toBeInTheDocument();
});

it("lists only the payment methods the checkout accepts, with the official brand marks", () => {
  navigation.pathname = "/";
  renderFooter();
  const methods = within(screen.getByRole("list", { name: "Formas de pagamento aceitas" }));
  const icons = methods.getAllByRole("img");

  expect(icons.map((icon) => icon.getAttribute("src"))).toEqual([
    "/images/payment-methods/pix.svg",
    "/images/payment-methods/visa.svg",
    "/images/payment-methods/mastercard.svg",
    "/images/payment-methods/elo.svg",
    "/images/payment-methods/american-express.svg",
    "/images/payment-methods/hipercard.svg",
    "/images/payment-methods/diners-club.svg",
    "/images/payment-methods/cabal.png",
  ]);
  expect(icons.map((icon) => icon.getAttribute("alt"))).toEqual([
    "Pix",
    "Visa",
    "Mastercard",
    "Elo",
    "American Express",
    "Hipercard",
    "Diners Club",
    "Cabal",
  ]);
  expect(methods.queryByLabelText("Boleto")).not.toBeInTheDocument();
});

it("shows the rights line without a CNPJ or social links", () => {
  navigation.pathname = "/";
  renderFooter();
  const footer = screen.getByRole("contentinfo");

  expect(
    within(footer).getByText("© 2026 MOTO SHOP BRASIL E-COMMERCE E MARKETPLACE. Todos os direitos reservados."),
  ).toBeInTheDocument();
  expect(footer).not.toHaveTextContent(/CNPJ/);
  expect(within(footer).queryByText(/Redes sociais/i)).not.toBeInTheDocument();
});

it("uses the stacked main logo in the footer, swapping black and orange plates on hover", () => {
  navigation.pathname = "/";
  renderFooter();
  const brand = within(screen.getByRole("contentinfo")).getByRole("link", { name: "O Moto Shop, página inicial" });
  expect(Array.from(brand.querySelectorAll("img"), (image) => image.getAttribute("src"))).toEqual([
    "/brand/logo-stacked-dark.webp",
    "/brand/logo-stacked-orange.webp",
  ]);
});

it("hides the storefront footer in the seller and admin areas", () => {
  for (const pathname of ["/seller", "/admin/orders"]) {
    navigation.pathname = pathname;
    renderFooter();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    cleanup();
  }
});

it("offers sign-in to visitors and the account to signed-in customers", () => {
  navigation.pathname = "/products";
  const { unmount } = renderFooter();
  const shortcuts = within(screen.getByRole("navigation", { name: "Atalhos" }));
  expect(shortcuts.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  unmount();

  auth.session = { user: { id: "user-1" } };
  renderFooter();
  const signedIn = within(screen.getByRole("navigation", { name: "Atalhos" }));
  expect(signedIn.queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
  expect(signedIn.getByRole("link", { name: "Minha conta" })).toHaveAttribute("href", "/account/profile");
});
