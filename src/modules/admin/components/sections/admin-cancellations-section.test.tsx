import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listCancellations: vi.fn(), thumbnails: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/image", () => ({
  // oxlint-disable-next-line nextjs/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/modules/returns/queries/admin-cancellations", () => ({
  listCancellationRequestsForAdmin: mocks.listCancellations,
}));
vi.mock("@/modules/sellers/queries/sellers", () => ({ listSellerOptionsForAdmin: vi.fn(async () => []) }));
vi.mock("@/modules/orders/queries/order-item-thumbnails", () => ({ getOrderItemThumbnails: mocks.thumbnails }));
vi.mock("@/modules/returns/components/cancellation-status-actions", () => ({ CancellationStatusActions: () => null }));

import { AdminCancellationsSection } from "./admin-cancellations-section";

afterEach(cleanup);

it("starts each item of the cancellation line with its photo, keeping the text as it was", async () => {
  const items = [
    { id: "i-1", productNameSnapshot: "Filtro de ar", quantity: 1 },
    { id: "i-2", productNameSnapshot: "Vela", quantity: 2 },
  ];
  mocks.listCancellations.mockResolvedValue({
    requests: [
      {
        id: "c-1",
        status: "REQUESTED",
        amountInCents: 9980,
        customerMessage: null,
        createdAt: new Date("2026-10-20T12:00:00Z"),
        seller: { store: { name: "Garagem MX" } },
        order: { orderNumber: "MS-1", customerName: "Carla", customerEmail: "carla@example.test" },
        sellerOrder: { items },
      },
    ],
    total: 1,
    page: 1,
    pageCount: 1,
  });
  mocks.thumbnails.mockResolvedValue(new Map([["i-1", { url: "https://ik.example/filtro.webp", alt: "" }]]));

  render(await AdminCancellationsSection({ searchParams: Promise.resolve({}) }));

  expect(mocks.thumbnails).toHaveBeenCalledWith(items);
  const line = screen.getByText(/Filtro de ar \(1\)/);
  const [withPhoto, withoutPhoto] = line.querySelectorAll("[data-testid=cart-item-thumbnail]");
  expect(withPhoto?.querySelector("img")).toHaveAttribute("src", "https://ik.example/filtro.webp");
  expect(withoutPhoto?.querySelector("img")).toBeNull();
  expect(line).toHaveTextContent("Filtro de ar (1) · Vela (2) · R$");
});
