import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { suspenseFallbackIn } from "../../../../../../tests/support/suspense-fallback";

const mocks = vi.hoisted(() => ({
  orderExists: vi.fn(),
  getOrder: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/modules/auth/application/authorization", () => ({ requireAdminAccess: vi.fn(async () => ({})) }));
vi.mock("@/modules/admin/queries/order-detail", () => ({
  adminOrderExists: mocks.orderExists,
  getAdminOrderDetail: mocks.getOrder,
}));
vi.mock("@/modules/admin/components/order-detail/admin-seller-order-card", () => ({
  AdminSellerOrderCard: () => null,
}));
vi.mock("@/modules/orders/components/order-detail/payment-section", () => ({ PaymentSection: () => null }));
vi.mock("@/modules/orders/queries/order-item-thumbnails", () => ({
  getOrderItemThumbnails: vi.fn(async () => new Map()),
}));

import AdminOrderDetailPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

it("answers 404 for any section other than orders", async () => {
  await expect(
    AdminOrderDetailPage({ params: Promise.resolve({ section: "returns", orderNumber: "MS-1" }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(mocks.orderExists).not.toHaveBeenCalled();
  expect(mocks.getOrder).not.toHaveBeenCalled();
});

it("answers 404 for an unknown order before any loading screen starts", async () => {
  mocks.orderExists.mockResolvedValue(false);
  await expect(
    AdminOrderDetailPage({ params: Promise.resolve({ section: "orders", orderNumber: "MS-404" }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(mocks.orderExists).toHaveBeenCalledWith("MS-404");
});

// Regression (findings of 27/10/2026): a click on an order in the Admin left the previous page on screen
// until the whole order arrived, as if nothing happened.
it("shows the Admin loading screen while an existing order loads", async () => {
  mocks.orderExists.mockResolvedValue(true);

  const page = await AdminOrderDetailPage({
    params: Promise.resolve({ section: "orders", orderNumber: "MS%2D202610%2D0001" }),
  });
  render(suspenseFallbackIn(page));

  expect(screen.getByRole("status", { name: "Carregando área administrativa" })).toBeInTheDocument();
  expect(mocks.orderExists).toHaveBeenCalledWith("MS-202610-0001");
  expect(mocks.getOrder).not.toHaveBeenCalled();
});
