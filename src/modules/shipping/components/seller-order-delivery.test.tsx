import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { SellerOrderDelivery } from "./seller-order-delivery";

type Order = ComponentProps<typeof SellerOrderDelivery>["order"];

afterEach(cleanup);

function buildOrder(overrides: Partial<Order>): Order {
  return {
    status: "PAID",
    shipment: { provider: "OWN" },
    items: [
      {
        id: "item-1",
        quantity: 1,
        productNameSnapshot: "Protetor de mão",
        variantDescriptionSnapshot: "Preto",
        skuSnapshot: "SKU-1",
      },
    ],
    order: {
      customerPhone: "11987654321",
      shippingAddress: {
        recipient: "Carla Mendes",
        street: "Avenida Paulista",
        number: "1000",
        complement: null,
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        postalCode: "01310100",
      },
    },
    ...overrides,
  } as unknown as Order;
}

describe("SellerOrderDelivery", () => {
  it("shows the masked address for a paid order (UX-02, UX-26)", () => {
    render(<SellerOrderDelivery order={buildOrder({})} />);

    expect(screen.getByRole("heading", { name: "Preparar entrega" })).toBeInTheDocument();
    expect(screen.getByText(/CEP 01310-100 · Telefone \(11\) 98765-4321/)).toBeInTheDocument();
  });

  it("hides the address and phone before payment (UX-02)", () => {
    render(<SellerOrderDelivery order={buildOrder({ status: "PENDING_PAYMENT" })} />);

    expect(screen.getByText(/Aguardando pagamento: não prepare ainda/)).toBeInTheDocument();
    expect(screen.queryByText(/Avenida Paulista/)).not.toBeInTheDocument();
  });

  it("hides the address while the cancellation is under review (UX-13)", () => {
    const { container } = render(<SellerOrderDelivery order={buildOrder({ status: "CANCELLATION_REQUESTED" })} />);

    expect(container).toBeEmptyDOMElement();
  });
});
