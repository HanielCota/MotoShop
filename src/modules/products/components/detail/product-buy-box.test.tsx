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
// Notices the storefront no longer shows: it behaves like production (margot#350).
const removedNotices = /As compras ainda não estão liberadas|Valor ilustrativo|exemplo ilustrativo/;

afterEach(cleanup);

describe("ProductBuyBox", () => {
  it("keeps the cart button without any payment or demo notice", () => {
    render(<ProductBuyBox variants={[variant]} isDemo={false} hasPriceRange={false} />);

    expect(screen.getByRole("button", { name: "Adicionar ao carrinho" })).toBeInTheDocument();
    expect(screen.queryByText(removedNotices)).not.toBeInTheDocument();
  });

  it("shows a test product like any other product: real SKU line and no illustrative labels", () => {
    render(<ProductBuyBox variants={[{ ...variant, stock: 10 }]} isDemo hasPriceRange={false} />);

    expect(screen.getByText("SKU SKU-1 · 10 em estoque")).toBeInTheDocument();
    expect(screen.queryByText(removedNotices)).not.toBeInTheDocument();
  });

  it("marks a test product option without stock as sold out, like any other product", () => {
    const soldOut = { ...variant, id: "variant-2", title: "Branco · G", stock: 0 };
    render(<ProductBuyBox variants={[variant, soldOut]} isDemo hasPriceRange={false} />);

    expect(screen.getByText(/R\$ 199,90 · Esgotado/)).toBeInTheDocument();
  });

  it("reads the old price and the offer as separate phrases", () => {
    const onSale = { ...variant, priceInCents: 89990, currentPriceInCents: 79990, onSale: true };
    render(<ProductBuyBox variants={[onSale]} isDemo={false} hasPriceRange={false} />);

    const oldPrice = screen.getByText(/Preço anterior/).parentElement;
    expect(oldPrice?.textContent?.replace(/\s/g, " ")).toMatch(/R\$ 899,90\. Oferta · 11% de desconto/);
  });
});
