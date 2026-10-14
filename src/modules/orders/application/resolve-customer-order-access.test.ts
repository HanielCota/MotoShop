import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { order: { findFirst: mocks.findFirst } } }));
vi.mock("@/modules/cart/infrastructure/cart-access", () => ({ hashGuestToken: (token: string) => `hash:${token}` }));

import { resolveCustomerOrderIdentity } from "./resolve-customer-order-access";

const recentOrder = { id: "order-1", createdAt: new Date("2026-10-01T00:00:00.000Z"), sellerOrders: [] };
const now = new Date("2026-10-14T00:00:00.000Z");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("resolveCustomerOrderIdentity", () => {
  it("returns null without any credential and never queries the database", async () => {
    await expect(resolveCustomerOrderIdentity({ orderNumber: "MS-1" })).resolves.toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("prefers the secure link token for a logged-in user opening a guest order", async () => {
    mocks.findFirst.mockResolvedValueOnce(recentOrder);
    await expect(
      resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "token", userId: "user-1", now }),
    ).resolves.toEqual({ guestAccessTokenHash: "hash:token" });
    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderNumber: "MS-1", guestAccessTokenHash: "hash:token" } }),
    );
  });

  it("falls back to the session user when the token does not match (claimed order)", async () => {
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(recentOrder);
    await expect(
      resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "old", userId: "user-1" }),
    ).resolves.toEqual({ userId: "user-1" });
    expect(mocks.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { orderNumber: "MS-1", userId: "user-1" } }),
    );
  });

  it("refuses an expired guest link but still lets the signed-in owner in", async () => {
    const oldOrder = { id: "order-1", createdAt: new Date("2026-01-01T00:00:00.000Z"), sellerOrders: [] };
    mocks.findFirst.mockResolvedValueOnce(oldOrder);
    await expect(resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "token", now })).resolves.toBeNull();

    mocks.findFirst.mockResolvedValueOnce(oldOrder).mockResolvedValueOnce(oldOrder);
    await expect(
      resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "token", userId: "user-1", now }),
    ).resolves.toEqual({ userId: "user-1" });
  });

  it("keeps a guest link open for 90 days after a late delivery", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      id: "order-1",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      sellerOrders: [{ shipment: { deliveredAt: new Date("2026-08-30T00:00:00.000Z") } }],
    });
    await expect(resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "token", now })).resolves.toEqual({
      guestAccessTokenHash: "hash:token",
    });
  });

  it("denies access when no credential owns the order", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(
      resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "x", userId: "intruder" }),
    ).resolves.toBeNull();
  });
});
