import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/cart/infrastructure/cart-access", () => ({ hashGuestToken: (token: string) => `hash:${token}` }));
vi.mock("@/lib/database", () => ({ db: { order: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } } }));

import { claimGuestOrder } from "./claim-guest-order";

const input = {
  orderNumber: "MS-100",
  accessToken: "secure-guest-token",
  userId: "user-a",
  userEmail: "buyer@example.test",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findFirst.mockResolvedValue({ id: "order-a", customerEmail: "Buyer@Example.Test" });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("claim guest order", () => {
  it("requires the token hash and an unclaimed order, then revokes the guest link atomically", async () => {
    await expect(claimGuestOrder(input)).resolves.toEqual({ orderNumber: "MS-100" });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { orderNumber: "MS-100", guestAccessTokenHash: "hash:secure-guest-token", userId: null },
      select: { id: true, customerEmail: true },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "order-a", userId: null, guestAccessTokenHash: "hash:secure-guest-token" },
      data: { userId: "user-a", guestAccessTokenHash: null },
    });
  });

  it("rejects a different account email without mutating the order", async () => {
    await expect(claimGuestOrder({ ...input, userEmail: "other@example.test" })).rejects.toThrow(/mesmo e-mail/);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("does not overwrite a claim won by another concurrent request", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(claimGuestOrder(input)).rejects.toThrow(/já foi vinculado/);
  });
});
