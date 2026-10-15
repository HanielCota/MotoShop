import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  claim: vi.fn(),
  readCookie: vi.fn(),
  clearCookie: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/modules/orders/application/claim-guest-order", () => ({ claimGuestOrder: mocks.claim }));
vi.mock("@/modules/orders/application/resolve-customer-order-access", () => ({
  resolveCustomerOrderIdentity: mocks.resolve,
}));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ assertRateLimit: vi.fn() }));
vi.mock("@/modules/orders/infrastructure/guest-order-cookie", () => ({
  readGuestOrderCookie: mocks.readCookie,
  clearGuestOrderCookie: mocks.clearCookie,
}));

import { claimGuestOrderAction } from "./claim-guest-order-action";

const token = "t".repeat(64);
const session = { user: { id: "user-1", email: "buyer@example.test", emailVerified: true } };

function form() {
  const data = new FormData();
  data.set("orderNumber", "MS-1");
  data.set("accessToken", "token-sent-by-the-browser-is-ignored");
  return data;
}

describe("claimGuestOrderAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue(session);
    mocks.claim.mockResolvedValue({ orderNumber: "MS-1" });
    mocks.resolve.mockResolvedValue({ guestAccessTokenHash: "guest-hash" });
  });

  it("claims with the guest identity behind the order cookie, clears the cookie and opens the order", async () => {
    mocks.readCookie.mockResolvedValue(token);

    await expect(claimGuestOrderAction({}, form())).rejects.toThrow("redirect:/orders/MS-1");
    expect(mocks.resolve).toHaveBeenCalledWith({ orderNumber: "MS-1", accessToken: token });
    expect(mocks.claim).toHaveBeenCalledWith({
      orderNumber: "MS-1",
      guestAccessTokenHash: "guest-hash",
      userId: "user-1",
      userEmail: "buyer@example.test",
      userEmailVerified: true,
    });
    expect(mocks.clearCookie).toHaveBeenCalledWith("MS-1");
  });

  it("refuses without the order cookie, even if the form carries a token", async () => {
    mocks.readCookie.mockResolvedValue(undefined);

    expect(await claimGuestOrderAction({}, form())).toEqual({ error: "O link do pedido é inválido." });
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("refuses a cookie token that no longer opens the order (expired or revoked)", async () => {
    mocks.readCookie.mockResolvedValue(token);
    mocks.resolve.mockResolvedValue(null);

    expect(await claimGuestOrderAction({}, form())).toEqual({ error: "O link do pedido é inválido." });
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("requires a signed-in account", async () => {
    mocks.session.mockResolvedValue(null);

    expect(await claimGuestOrderAction({}, form())).toHaveProperty("error");
    expect(mocks.claim).not.toHaveBeenCalled();
  });
});
