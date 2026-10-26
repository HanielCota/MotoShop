import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/shared/storage/public-storage-url", () => ({
  getPublicStorageImageUrl: (key: string) => `/images/${key}`,
}));
vi.mock("next/image", () => ({
  // oxlint-disable-next-line nextjs/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));

import { CustomerOrderCard } from "./customer-order-card";

afterEach(cleanup);

const order = {
  orderNumber: "MS-1",
  status: "PENDING_PAYMENT",
  totalAmountInCents: 19970,
  createdAt: new Date("2026-10-08T12:00:00Z"),
  payments: [{ status: "PENDING", method: "pix" }],
  sellerOrders: [
    {
      id: "so-1",
      status: "PENDING_PAYMENT",
      storeNameSnapshot: "Garagem MX",
      items: [
        { id: "i-1", productNameSnapshot: "Filtro de ar", product: { images: [{ storageKey: "demo/filtro.webp" }] } },
        { id: "i-2", productNameSnapshot: "Vela", product: null },
      ],
      shipment: null,
    },
  ],
} as unknown as ComponentProps<typeof CustomerOrderCard>["order"];

it("shows one customer-facing status, the first product and links the whole card", () => {
  render(<CustomerOrderCard order={order} />);

  expect(screen.getByText("Pague para confirmar")).toBeInTheDocument();
  expect(screen.queryByText(/Pagamento:/)).not.toBeInTheDocument();
  expect(screen.getByText("Filtro de ar")).toBeInTheDocument();
  expect(screen.getByText("Garagem MX · +1 item")).toBeInTheDocument();
  expect(screen.getByText("Ver pedido e pagar")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "MS-1" })).toHaveAttribute("href", "/orders/MS-1");
});

it("shows the same placeholder as the cart when the first product has no photo", () => {
  const withoutPhoto = {
    ...order,
    sellerOrders: [{ ...order.sellerOrders[0], items: [{ id: "i-2", productNameSnapshot: "Vela", product: null }] }],
  } as unknown as ComponentProps<typeof CustomerOrderCard>["order"];
  render(<CustomerOrderCard order={withoutPhoto} />);

  const thumbnail = screen.getByTestId("cart-item-thumbnail");
  expect(thumbnail).toHaveAttribute("aria-hidden", "true");
  expect(thumbnail.querySelector("img")).toBeNull();
});
