import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  identity: vi.fn(),
  cookie: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/modules/orders/application/resolve-customer-order-access", () => ({
  resolveCustomerOrderIdentity: mocks.identity,
}));
vi.mock("@/modules/orders/infrastructure/guest-order-cookie", () => ({
  readGuestOrderCookie: mocks.cookie,
  guestOrderPath: (orderNumber: string) => `/orders/${encodeURIComponent(orderNumber)}`,
}));
vi.mock("@/modules/returns/queries/customer-orders", () => ({ getCustomerOrder: vi.fn() }));
vi.mock("@/modules/customers/components/customer-account-navigation", () => ({
  CustomerAccountNavigation: () => null,
}));
vi.mock("@/modules/orders/components/claim-guest-order-form", () => ({ ClaimGuestOrderForm: () => null }));
vi.mock("@/modules/orders/components/order-detail/order-summary", () => ({ OrderSummary: () => null }));
vi.mock("@/modules/orders/components/order-detail/payment-section", () => ({ PaymentSection: () => null }));
vi.mock("@/modules/orders/components/order-detail/seller-order-section", () => ({ SellerOrderSection: () => null }));
vi.mock("@/modules/orders/queries/order-item-thumbnails", () => ({
  getOrderItemThumbnails: vi.fn(async () => new Map()),
}));

import CustomerOrderPage from "./page";

function openOrder() {
  return CustomerOrderPage({
    params: Promise.resolve({ orderNumber: "MS-202610-0001" }),
    searchParams: Promise.resolve({}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookie.mockResolvedValue(null);
  mocks.identity.mockResolvedValue(null);
});

it("sends a signed-out visitor to the login and back to the order", async () => {
  mocks.session.mockResolvedValue(null);

  await expect(openOrder()).rejects.toThrow("redirect:/login?next=%2Forders%2FMS-202610-0001");
  expect(mocks.notFound).not.toHaveBeenCalled();
});

it("keeps the not-found page for a signed-in customer who does not own the order", async () => {
  mocks.session.mockResolvedValue({ user: { id: "buyer", email: "buyer@example.test" } });

  await expect(openOrder()).rejects.toThrow("not-found");
  expect(mocks.redirect).not.toHaveBeenCalled();
});
