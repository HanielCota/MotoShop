import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  // oxlint-disable-next-line nextjs/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { SellerOrderDelivery } from "./seller-order-delivery";

type Order = ComponentProps<typeof SellerOrderDelivery>["order"];

afterEach(cleanup);

const noThumbnails = new Map<string, { url: string; alt: string }>();

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
    render(<SellerOrderDelivery order={buildOrder({})} thumbnails={noThumbnails} />);

    expect(screen.getByRole("heading", { name: "Preparar entrega" })).toBeInTheDocument();
    expect(screen.getByText(/CEP 01310-100 · Telefone \(11\) 98765-4321/)).toBeInTheDocument();
  });

  it("hides the address and phone before payment (UX-02)", () => {
    render(<SellerOrderDelivery order={buildOrder({ status: "PENDING_PAYMENT" })} thumbnails={noThumbnails} />);

    expect(screen.getByText(/Aguardando pagamento: não prepare ainda/)).toBeInTheDocument();
    expect(screen.queryByText(/Avenida Paulista/)).not.toBeInTheDocument();
  });

  it("hides the address while the cancellation is under review (UX-13)", () => {
    const { container } = render(
      <SellerOrderDelivery order={buildOrder({ status: "CANCELLATION_REQUESTED" })} thumbnails={noThumbnails} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("starts each item line with the product photo", () => {
    const thumbnails = new Map([["item-1", { url: "https://ik.example/protetor.webp", alt: "" }]]);
    render(<SellerOrderDelivery order={buildOrder({})} thumbnails={thumbnails} />);

    const line = screen.getByRole("listitem");
    expect(line.firstElementChild).toHaveAttribute("data-testid", "cart-item-thumbnail");
    expect(line.querySelector("img")).toHaveAttribute("src", "https://ik.example/protetor.webp");
    expect(line).toHaveTextContent("1 × Protetor de mão · Preto · SKU SKU-1");
  });
});
