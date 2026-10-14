import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: vi.fn() }));
vi.mock("@/modules/orders/application/resolve-customer-order-access", () => ({
  resolveCustomerOrderIdentity: vi.fn(),
}));
vi.mock("@/modules/returns/queries/customer-orders", () => ({ getCustomerOrder: vi.fn() }));
vi.mock("../application/recover-payment", () => ({ recoverPayment: vi.fn() }));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ assertRateLimit: vi.fn() }));
import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";
import { ApplicationError } from "@/shared/errors/application-error";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getCustomerOrder } from "@/modules/returns/queries/customer-orders";
import { resolveCustomerOrderIdentity } from "@/modules/orders/application/resolve-customer-order-access";
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
  // Stand-in for the shared access rule: only "valid-token" opens the guest order.
  vi.mocked(resolveCustomerOrderIdentity).mockImplementation(async (input) => {
    if (input.accessToken === "valid-token") return { guestAccessTokenHash: "hashed-guest-token" };
    return input.userId ? { userId: input.userId } : null;
  });
});
it("never queries the provider without an authenticated order identity", async () => {
  expect(await refreshPendingPaymentAction({}, form())).toHaveProperty("error");
  expect(getCustomerOrder).not.toHaveBeenCalled();
  expect(recoverPayment).not.toHaveBeenCalled();
});
it("does not recover an order inaccessible to the guest", async () => {
  expect(await refreshPendingPaymentAction({}, form("wrong-token"))).toHaveProperty("error");
  expect(resolveCustomerOrderIdentity).toHaveBeenCalledWith({
    orderNumber: "MS-123",
    accessToken: "wrong-token",
    userId: undefined,
  });
  expect(getCustomerOrder).not.toHaveBeenCalled();
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
it("rate limits manual refreshes per order number before querying the gateway", async () => {
  vi.mocked(assertRateLimit).mockRejectedValue(
    new ApplicationError({ code: "CONFLICT", statusCode: 429, message: "Muitas tentativas em pouco tempo." }),
  );
  expect(await refreshPendingPaymentAction({}, form("valid-token"))).toEqual({
    error: "Muitas tentativas em pouco tempo.",
  });
  expect(assertRateLimit).toHaveBeenCalledWith({ key: "payment-refresh:MS-123", windowSeconds: 60, max: 3 });
  expect(getCustomerOrder).not.toHaveBeenCalled();
  expect(recoverPayment).not.toHaveBeenCalled();
});
it("tells the customer when a never-sent charge was released", async () => {
  vi.mocked(getCustomerOrder).mockResolvedValue({ payments: [{ id: "local", status: "PENDING" }] } as never);
  vi.mocked(recoverPayment).mockResolvedValue({ outcome: "RELEASED" });
  expect(await refreshPendingPaymentAction({}, form("valid-token"))).toMatchObject({
    success: expect.stringContaining("cancelado"),
  });
});
