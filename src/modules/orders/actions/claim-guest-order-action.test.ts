import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), claim: vi.fn(), readCookie: vi.fn(), clearCookie: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/modules/orders/application/claim-guest-order", () => ({ claimGuestOrder: mocks.claim }));
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
  });

  it("claims with the token from the order cookie and clears the cookie afterwards", async () => {
    mocks.readCookie.mockResolvedValue(token);

    expect(await claimGuestOrderAction({}, form())).toEqual({ success: true });
    expect(mocks.claim).toHaveBeenCalledWith({
      orderNumber: "MS-1",
      accessToken: token,
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

  it("requires a signed-in account", async () => {
    mocks.session.mockResolvedValue(null);

    expect(await claimGuestOrderAction({}, form())).toHaveProperty("error");
    expect(mocks.claim).not.toHaveBeenCalled();
  });
});
