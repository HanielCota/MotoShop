import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import HomeLoading from "@/app/(home)/loading";
import AccountLoading from "@/app/account/loading";
import CartLoading from "@/app/cart/loading";
import CheckoutLoading from "@/app/checkout/loading";
import FavoritesLoading from "@/app/favorites/loading";
import OrdersLoading from "@/app/orders/(list)/loading";
import { AdminPageSkeleton } from "@/modules/admin/components/admin-page-skeleton";
import { ProductDetailSkeleton } from "@/modules/products/components/detail/product-detail-skeleton";
import { SellerPageSkeleton } from "@/modules/sellers/components/seller-page-skeleton";

import { storefrontSkeletonHeightClassName } from "./skeleton";

afterEach(cleanup);

it("keeps the storefront loading screens one screen tall, so the footer does not flash mid-screen", () => {
  const screens = [
    { element: <CartLoading />, label: "Carregando carrinho" },
    { element: <CheckoutLoading />, label: "Carregando finalização da compra" },
    { element: <OrdersLoading />, label: "Carregando pedidos" },
    { element: <ProductDetailSkeleton />, label: "Carregando produto" },
  ];

  for (const { element, label } of screens) {
    render(element);
    expect(screen.getByRole("status", { name: label })).toHaveClass(storefrontSkeletonHeightClassName);
    cleanup();
  }
});

it("leaves the seller and admin loading screens at their own height, since those areas have no footer", () => {
  render(
    <>
      <SellerPageSkeleton />
      <AdminPageSkeleton />
    </>,
  );

  expect(screen.getByRole("status", { name: "Carregando a Central do Lojista" })).not.toHaveClass(
    storefrontSkeletonHeightClassName,
  );
  expect(screen.getByRole("status", { name: "Carregando área administrativa" })).not.toHaveClass(
    storefrontSkeletonHeightClassName,
  );
});

// Regression (findings of 27/10/2026): with no loading screen, a click on a link to these pages left the
// previous page on screen until the new one arrived (up to 1.7 s on a cold visit), as if nothing happened.
// Pages that call notFound() stay out of this list on purpose: see tests/unit/not-found-status.test.ts.
it("gives the home, favorites and account pages a loading screen announced to screen readers", () => {
  render(
    <>
      <HomeLoading />
      <FavoritesLoading />
      <AccountLoading />
    </>,
  );

  expect(screen.getAllByRole("status", { name: "Carregando produtos" })).toHaveLength(2);
  expect(screen.getByRole("status", { name: "Carregando sua conta" })).toBeInTheDocument();
});

it("keeps the account loading screen one screen tall", () => {
  render(<AccountLoading />);

  expect(screen.getByRole("status", { name: "Carregando sua conta" })).toHaveClass(storefrontSkeletonHeightClassName);
});

it("keeps the home loading screen one screen tall", () => {
  const { container } = render(<HomeLoading />);

  expect(container.firstElementChild).toHaveClass(storefrontSkeletonHeightClassName);
});
