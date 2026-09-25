import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: vi.fn() }));
vi.mock("@/modules/cart/infrastructure/cart-access", () => ({ hashGuestToken: vi.fn(() => "hashed-guest-token") }));
vi.mock("@/modules/returns/queries/customer-orders", () => ({ getCustomerOrder: vi.fn() }));
vi.mock("../application/recover-payment", () => ({ recoverPayment: vi.fn() }));
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getCustomerOrder } from "@/modules/returns/queries/customer-orders";
import { recoverPayment } from "../application/recover-payment";
import { refreshPendingPaymentAction } from "./payment-actions";

function form(token?: string) {
  const data = new FormData();
  data.set("orderNumber", "MS-123");
  if (token) data.set("accessToken", token);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentSession).mockResolvedValue(null);
  vi.mocked(getCustomerOrder).mockResolvedValue(null);
  vi.mocked(recoverPayment).mockResolvedValue({ outcome: "UNRESOLVED" });
});
it("never queries the provider without an authenticated order identity", async () => {
  expect(await refreshPendingPaymentAction({}, form())).toHaveProperty("error");
  expect(getCustomerOrder).not.toHaveBeenCalled();
  expect(recoverPayment).not.toHaveBeenCalled();
});
it("does not recover an order inaccessible to the guest", async () => {
  expect(await refreshPendingPaymentAction({}, form("wrong-token"))).toHaveProperty("error");
  expect(getCustomerOrder).toHaveBeenCalledWith("MS-123", { guestAccessTokenHash: "hashed-guest-token" });
  expect(recoverPayment).not.toHaveBeenCalled();
});
it("recovers a guest payment without an external id after ownership validation", async () => {
  vi.mocked(getCustomerOrder).mockResolvedValue({
    payments: [{ id: "local", status: "PENDING", externalId: null }],
  } as never);
  expect(await refreshPendingPaymentAction({}, form("valid-token"))).toMatchObject({
    success: expect.stringContaining("pendente"),
  });
  expect(recoverPayment).toHaveBeenCalledWith("local");
});
it("uses the authenticated user scope for payments awaiting capture", async () => {
  vi.mocked(getCurrentSession).mockResolvedValue({ user: { id: "user-1" } } as never);
  vi.mocked(getCustomerOrder).mockResolvedValue({ payments: [{ id: "local", status: "AUTHORIZED" }] } as never);
  await refreshPendingPaymentAction({}, form());
  expect(getCustomerOrder).toHaveBeenCalledWith("MS-123", { userId: "user-1" });
  expect(recoverPayment).toHaveBeenCalledWith("local");
});
