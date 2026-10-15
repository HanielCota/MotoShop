import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), setCookie: vi.fn(), identity: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: vi.fn(async () => null) }));
vi.mock("@/modules/cart/infrastructure/cart-access", () => ({ getCartIdentity: mocks.identity }));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ assertRateLimit: vi.fn() }));
vi.mock("@/modules/orders/infrastructure/guest-order-cookie", () => ({ setGuestOrderCookie: mocks.setCookie }));
vi.mock("../application/checkout-service", () => ({ executeCheckout: mocks.execute }));
vi.mock("../schemas/checkout", () => ({
  checkoutSchema: { safeParse: () => ({ success: true, data: { checkoutIdempotencyKey: "key" } }) },
}));

import { createCheckoutAction } from "./checkout-actions";

describe("createCheckoutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.identity.mockResolvedValue({ guestAccessTokenHash: "cart-hash" });
  });

  it("keeps the guest order token in the order cookie and out of the response", async () => {
    mocks.execute.mockResolvedValue({ orderNumber: "MS-1", guestAccessToken: "secret-token" });

    const result = await createCheckoutAction({}, new FormData());

    expect(result).toEqual({ orderNumber: "MS-1" });
    expect(mocks.setCookie).toHaveBeenCalledWith("MS-1", "secret-token");
  });

  it("sets no cookie for a signed-in customer's order", async () => {
    mocks.identity.mockResolvedValue({ userId: "user-1" });
    mocks.execute.mockResolvedValue({ orderNumber: "MS-2" });

    expect(await createCheckoutAction({}, new FormData())).toEqual({ orderNumber: "MS-2" });
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});
