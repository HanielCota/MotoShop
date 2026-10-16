import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  simulated: vi.fn((): unknown => undefined),
  setCookie: vi.fn(),
  identity: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: vi.fn(async () => null) }));
vi.mock("@/modules/cart/infrastructure/cart-access", () => ({ getCartIdentity: mocks.identity }));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ assertRateLimit: vi.fn() }));
vi.mock("@/modules/orders/infrastructure/guest-order-cookie", () => ({ setGuestOrderCookie: mocks.setCookie }));
// The real order path; a test-only cart answers with the simulated purchase instead (margot#351).
vi.mock("../application/submit-checkout", () => ({
  submitCheckout: async (...args: unknown[]) => {
    const simulated = mocks.simulated();
    if (simulated) return { kind: "simulated", purchase: simulated };
    return { kind: "order", result: await mocks.execute(...args) };
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-vercel-forwarded-for": "203.0.113.7" }) }));
vi.mock("../schemas/checkout", () => ({
  checkoutSchema: {
    safeParse: () => ({ success: true, data: { checkoutIdempotencyKey: "key", customerTaxId: "52998224725" } }),
  },
}));

import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";

import { createCheckoutAction } from "./checkout-actions";

describe("createCheckoutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.identity.mockResolvedValue({ guestAccessTokenHash: "cart-hash" });
  });

  it("returns the simulated purchase summary without an order, a cookie or a payment", async () => {
    const purchase = { paymentMethod: "pix", stores: [], totals: { totalInCents: 1000 } };
    mocks.simulated.mockReturnValueOnce(purchase);

    const result = await createCheckoutAction({}, new FormData());

    expect(result).toEqual({ simulatedPurchase: purchase });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
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

  it("also limits by client IP and CPF, since a new cookie resets the cart limit (M-06)", async () => {
    mocks.execute.mockResolvedValue({ orderNumber: "MS-3" });

    await createCheckoutAction({}, new FormData());

    expect(assertRateLimit).toHaveBeenCalledWith({ key: "checkout:ip:203.0.113.7", windowSeconds: 60, max: 10 });
    expect(assertRateLimit).toHaveBeenCalledWith({ key: "checkout:tax-id:52998224725", windowSeconds: 600, max: 5 });
  });

  it("does not create the order when the CPF already has too many pending orders", async () => {
    const { ApplicationError } = await import("@/shared/errors/application-error");
    mocks.execute.mockRejectedValue(
      new ApplicationError({ code: "CONFLICT", statusCode: 409, message: "Você já tem pedidos aguardando pagamento." }),
    );

    expect(await createCheckoutAction({}, new FormData())).toEqual({
      error: "Você já tem pedidos aguardando pagamento.",
    });
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});
