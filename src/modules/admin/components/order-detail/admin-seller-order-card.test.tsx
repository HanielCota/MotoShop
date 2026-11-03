import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  // oxlint-disable-next-line nextjs/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/modules/returns/components/return-photo-gallery", () => ({ ReturnPhotoGallery: () => null }));
vi.mock("@/modules/returns/components/cancellation-status-actions", () => ({ CancellationStatusActions: () => null }));
vi.mock("@/modules/returns/components/return-status-actions", () => ({ ReturnStatusActions: () => null }));
vi.mock("@/modules/disputes/components/dispute-status-actions", () => ({ DisputeStatusActions: () => null }));

import { AdminSellerOrderCard } from "./admin-seller-order-card";

afterEach(cleanup);

const item = (id: string, name: string) => ({
  id,
  quantity: 1,
  productNameSnapshot: name,
  variantDescriptionSnapshot: "Padrão",
  skuSnapshot: `SKU-${id}`,
  totalAmountInCents: 4990,
});

const sellerOrder = {
  id: "so-1",
  status: "PAID",
  storeNameSnapshot: "Garagem MX",
  itemsSubtotalInCents: 9980,
  customerShippingAmountInCents: 0,
  discountAmountInCents: 0,
  shipment: null,
  cancellationRequests: [],
  returnRequests: [],
  disputes: [],
  items: [item("i-1", "Filtro de ar"), item("i-2", "Vela")],
} as unknown as ComponentProps<typeof AdminSellerOrderCard>["sellerOrder"];

it("starts each item with its product photo, and the placeholder when the item has none", () => {
  render(
    <AdminSellerOrderCard
      orderNumber="MS-1"
      sellerOrder={sellerOrder}
      thumbnails={new Map([["i-1", { url: "https://ik.example/filtro.webp", alt: "" }]])}
    />,
  );

  const [withPhoto, withoutPhoto] = screen.getAllByTestId("cart-item-thumbnail");
  expect(withPhoto?.querySelector("img")).toHaveAttribute("src", "https://ik.example/filtro.webp");
  expect(withoutPhoto?.querySelector("img")).toBeNull();
  expect(screen.getByText(/1 × Filtro de ar · Padrão · SKU/)).toBeInTheDocument();
});
