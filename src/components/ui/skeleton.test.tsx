import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import CartLoading from "@/app/cart/loading";
import CheckoutLoading from "@/app/checkout/loading";
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
