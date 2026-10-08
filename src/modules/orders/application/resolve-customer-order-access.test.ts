import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { order: { findFirst: mocks.findFirst } } }));
vi.mock("@/modules/cart/infrastructure/cart-access", () => ({ hashGuestToken: (token: string) => `hash:${token}` }));

import { resolveCustomerOrderIdentity } from "./resolve-customer-order-access";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("resolveCustomerOrderIdentity", () => {
  it("returns null without any credential and never queries the database", async () => {
    await expect(resolveCustomerOrderIdentity({ orderNumber: "MS-1" })).resolves.toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("prefers the secure link token for a logged-in user opening a guest order", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "order-1" });
    await expect(
      resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "token", userId: "user-1" }),
    ).resolves.toEqual({ guestAccessTokenHash: "hash:token" });
    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderNumber: "MS-1", guestAccessTokenHash: "hash:token" } }),
    );
  });

  it("falls back to the session user when the token does not match (claimed order)", async () => {
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "order-1" });
    await expect(
      resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "old", userId: "user-1" }),
    ).resolves.toEqual({ userId: "user-1" });
    expect(mocks.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { orderNumber: "MS-1", userId: "user-1" } }),
    );
  });

  it("denies access when no credential owns the order", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(
      resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "x", userId: "intruder" }),
    ).resolves.toBeNull();
  });
});
