import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps, RefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("@/modules/payments/components/secure-card-fields", () => ({
  SecureCardFields: () => <div>Campos do cartão</div>,
}));

import type { SimulatedPurchase } from "../domain/simulated-purchase";
import { CheckoutPaymentSection } from "./checkout-payment-section";
import { SimulatedPurchaseConfirmation } from "./simulated-purchase-confirmation";

afterEach(cleanup);

const purchase: SimulatedPurchase = {
  customer: { name: "Carla Mendes", email: "carla@example.test", phone: "(11) 90000-0000" },
  address: {
    street: "Avenida Paulista",
    number: "1000",
    complement: "Apto 52",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    postalCode: "01310100",
  },
  paymentMethod: "pix",
  stores: [
    {
      storeName: "Garagem MX",
      items: [{ id: "item-1", name: "Óculos Vista Pro", variant: "Preto", quantity: 2, lineTotalInCents: 49_980 }],
      shipping: { label: "Entrega da loja · Grande São Paulo", estimatedDeliveryDays: 3, priceInCents: 1_990 },
    },
  ],
  totals: {
    itemCount: 2,
    itemsSubtotalInCents: 49_980,
    discountInCents: 0,
    shippingInCents: 1_990,
    totalInCents: 51_970,
  },
};

describe("SimulatedPurchaseConfirmation", () => {
  it("shows the purchase summary the customer filled in, without an order number", () => {
    render(<SimulatedPurchaseConfirmation purchase={purchase} />);

    expect(screen.getByRole("heading", { level: 1, name: "Compra concluída" })).toBeInTheDocument();
    expect(screen.getByText("Obrigado, Carla. Confira abaixo o resumo da sua compra.")).toBeInTheDocument();
    expect(screen.getByText("Garagem MX")).toBeInTheDocument();
    expect(screen.getByText(/2× Óculos Vista Pro/)).toBeInTheDocument();
    expect(screen.getByText("Entrega da loja · Grande São Paulo")).toBeInTheDocument();
    expect(screen.getByText(/Avenida Paulista, 1000/)).toBeInTheDocument();
    expect(screen.getByText("Pix")).toBeInTheDocument();
    const summary = screen.getByRole("complementary", { name: "Resumo" });
    expect(within(summary).getByText("Total").nextElementSibling).toHaveTextContent("519,70");
    expect(screen.queryByText(/MS-|Pedido nº|demonstração/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continuar comprando" })).toHaveAttribute("href", "/products");
  });
});

describe("CheckoutPaymentSection for test products", () => {
  it("offers only Pix: no card option, card fields or card notice", () => {
    render(
      <CheckoutPaymentSection
        paymentAvailable
        pixOnly
        cardPublicKey="TEST-public-key"
        paymentType="pix"
        onPaymentTypeChange={vi.fn()}
        disabled={false}
        cardRef={{ current: null } as RefObject<null>}
      />,
    );

    expect(screen.getByRole("radio", { name: "Pix" })).toBeInTheDocument();
    expect(screen.queryByText(/Cartão/)).not.toBeInTheDocument();
    expect(screen.queryByText("Campos do cartão")).not.toBeInTheDocument();
  });
});
