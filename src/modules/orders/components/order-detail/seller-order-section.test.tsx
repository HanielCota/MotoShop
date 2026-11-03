import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  // oxlint-disable-next-line nextjs/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/modules/returns/components/request-cancellation-form", () => ({ RequestCancellationForm: () => null }));
vi.mock("@/modules/returns/components/request-return-form", () => ({ RequestReturnForm: () => null }));
vi.mock("@/modules/disputes/components/request-dispute-form", () => ({ RequestDisputeForm: () => null }));
vi.mock("@/modules/reviews/components/review-form", () => ({ ReviewForm: () => null }));
vi.mock("./after-sales-details", () => ({ DisputeDetails: () => null, ReturnDetails: () => null }));

import { SellerOrderSection } from "./seller-order-section";

afterEach(cleanup);

const item = (id: string, name: string) => ({
  id,
  productNameSnapshot: name,
  variantDescriptionSnapshot: "Padrão",
  skuSnapshot: `SKU-${id}`,
  quantity: 1,
  totalAmountInCents: 4990,
  productReview: null,
  returnItems: [],
});

const sellerOrder = {
  id: "so-1",
  sellerId: "seller-1",
  status: "PENDING_PAYMENT",
  storeNameSnapshot: "Garagem MX",
  customerShippingAmountInCents: 0,
  shipment: null,
  cancellationRequests: [],
  disputes: [],
  items: [item("i-1", "Filtro de ar"), item("i-2", "Vela")],
} as unknown as ComponentProps<typeof SellerOrderSection>["sellerOrder"];

it("shows each item's product photo, and the placeholder when the item has none", () => {
  render(
    <SellerOrderSection
      orderNumber="MS-1"
      sellerOrder={sellerOrder}
      thumbnails={new Map([["i-1", { url: "https://ik.example/filtro.webp", alt: "" }]])}
      canReview={false}
      sellerAlreadyReviewed={false}
    />,
  );

  const [withPhoto, withoutPhoto] = screen.getAllByRole("listitem");
  if (withPhoto == null || withoutPhoto == null) throw new Error("expected two item rows");
  expect(within(withPhoto).getByText("Filtro de ar")).toBeInTheDocument();
  expect(withPhoto.querySelector("img")).toHaveAttribute("src", "https://ik.example/filtro.webp");
  expect(within(withoutPhoto).getByTestId("cart-item-thumbnail").querySelector("img")).toBeNull();
});
