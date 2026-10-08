import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { SiteFooter } from "./site-footer";
import { StorefrontOnly } from "./storefront-only";

afterEach(cleanup);

function renderFooter() {
  return render(
    <StorefrontOnly>
      <SiteFooter />
    </StorefrontOnly>,
  );
}

it("renders the shared footer on storefront routes with one seller label", () => {
  navigation.pathname = "/products";
  renderFooter();
  const footer = screen.getByRole("contentinfo");
  expect(within(footer).getByRole("link", { name: "Venda no Moto Shop" })).toHaveAttribute("href", "/seller");
  expect(within(footer).getByText("O Marketplace de quem vive o OFF-ROAD!")).toBeInTheDocument();
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
