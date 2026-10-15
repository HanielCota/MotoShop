import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrder: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/modules/auth/application/authorization", () => ({ requireAdminAccess: vi.fn(async () => ({})) }));
vi.mock("@/modules/admin/queries/order-detail", () => ({ getAdminOrderDetail: mocks.getOrder }));
vi.mock("@/modules/admin/components/order-detail/admin-seller-order-card", () => ({
  AdminSellerOrderCard: () => null,
}));
vi.mock("@/modules/orders/components/order-detail/payment-section", () => ({ PaymentSection: () => null }));

import AdminOrderDetailPage from "./page";

it("answers 404 for any section other than orders", async () => {
  await expect(
    AdminOrderDetailPage({ params: Promise.resolve({ section: "returns", orderNumber: "MS-1" }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(mocks.getOrder).not.toHaveBeenCalled();
});

it("answers 404 for an unknown order", async () => {
  mocks.getOrder.mockResolvedValue(null);
  await expect(
    AdminOrderDetailPage({ params: Promise.resolve({ section: "orders", orderNumber: "MS-404" }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(mocks.getOrder).toHaveBeenCalledWith("MS-404");
});
