import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductBuyBox, type BuyBoxVariant } from "./product-buy-box";

// The cart button calls a Server Action; these tests only cover what the buy box shows around it.
vi.mock("@/modules/cart/components/add-to-cart-button", () => ({
  AddToCartButton: () => <button type="button">Adicionar ao carrinho</button>,
}));

const variant: BuyBoxVariant = {
  id: "variant-1",
  title: "Preto · M",
  sku: "SKU-1",
  priceInCents: 19990,
  currentPriceInCents: 19990,
  onSale: false,
  stock: 3,
};
const paymentNotice = /As compras ainda não estão liberadas/;

afterEach(cleanup);

describe("ProductBuyBox", () => {
  it("keeps the cart button and warns that payment is not open yet", () => {
    render(<ProductBuyBox variants={[variant]} isDemo={false} hasPriceRange={false} paymentAvailable={false} />);

    expect(screen.getByRole("button", { name: "Adicionar ao carrinho" })).toBeInTheDocument();
    expect(screen.getByText(paymentNotice)).toBeInTheDocument();
  });

  it("shows no payment warning when payment is available", () => {
    render(<ProductBuyBox variants={[variant]} isDemo={false} hasPriceRange={false} paymentAvailable />);

    expect(screen.queryByText(paymentNotice)).not.toBeInTheDocument();
  });

  it("leaves demo products to their own presentation notice", () => {
    render(<ProductBuyBox variants={[variant]} isDemo hasPriceRange={false} paymentAvailable={false} />);

    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).not.toBeInTheDocument();
    expect(screen.queryByText(paymentNotice)).not.toBeInTheDocument();
  });

  it("reads the old price and the offer as separate phrases", () => {
    const onSale = { ...variant, priceInCents: 89990, currentPriceInCents: 79990, onSale: true };
    render(<ProductBuyBox variants={[onSale]} isDemo={false} hasPriceRange={false} paymentAvailable />);

    const oldPrice = screen.getByText(/Preço anterior/).parentElement;
    expect(oldPrice?.textContent?.replace(/\s/g, " ")).toMatch(/R\$ 899,90\. Oferta · 11% off/);
  });
});
