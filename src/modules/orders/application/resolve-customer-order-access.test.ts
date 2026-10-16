import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), isLinkToken: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { order: { findFirst: mocks.findFirst } } }));
vi.mock("@/modules/cart/infrastructure/cart-access", () => ({ hashGuestToken: (token: string) => `hash:${token}` }));
vi.mock("../infrastructure/guest-order-link-token", () => ({ isGuestOrderLinkToken: mocks.isLinkToken }));

import { resolveCustomerOrderIdentity } from "./resolve-customer-order-access";

const now = new Date("2026-10-14T00:00:00.000Z");
const recent = { createdAt: new Date("2026-10-01T00:00:00.000Z"), sellerOrders: [] };
const old = { createdAt: new Date("2026-01-01T00:00:00.000Z"), sellerOrders: [] };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("resolveCustomerOrderIdentity", () => {
  it("returns null without any credential and never queries the database", async () => {
    await expect(resolveCustomerOrderIdentity({ orderNumber: "MS-1" })).resolves.toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("opens a guest order with the checkout token, before the signed-in user", async () => {
    mocks.findFirst.mockResolvedValueOnce(recent);
    await expect(
      resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "token", userId: "user-1", now }),
    ).resolves.toEqual({ guestAccessTokenHash: "hash:token" });
    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderNumber: "MS-1", guestAccessTokenHash: "hash:token" } }),
    );
  });

  it("opens an unclaimed guest order with the e-mail link token, as that order's guest identity", async () => {
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "order-1",
      guestAccessTokenHash: "stored-hash",
      ...recent,
    });
    mocks.isLinkToken.mockReturnValue(true);

    await expect(resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "link", now })).resolves.toEqual({
      guestAccessTokenHash: "stored-hash",
    });
    expect(mocks.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { orderNumber: "MS-1", userId: null, guestAccessTokenHash: { not: null } } }),
    );
    expect(mocks.isLinkToken).toHaveBeenCalledWith("order-1", "link");
  });

  it("refuses a wrong e-mail link token", async () => {
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "order-1",
      guestAccessTokenHash: "stored-hash",
      ...recent,
    });
    mocks.isLinkToken.mockReturnValue(false);

    await expect(resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "forged", now })).resolves.toBeNull();
  });

  it("refuses expired guest tokens of both kinds but still lets the signed-in owner in", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(old)
      .mockResolvedValueOnce({ id: "order-1", guestAccessTokenHash: "stored-hash", ...old });
    mocks.isLinkToken.mockReturnValue(true);
    await expect(resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "token", now })).resolves.toBeNull();

    mocks.findFirst.mockResolvedValueOnce(old).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "order-1" });
    await expect(
      resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "token", userId: "user-1", now }),
    ).resolves.toEqual({ userId: "user-1" });
  });

  it("keeps a guest link open for 90 days after a late delivery", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      sellerOrders: [{ shipment: { deliveredAt: new Date("2026-08-30T00:00:00.000Z") } }],
    });
    await expect(resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "token", now })).resolves.toEqual({
      guestAccessTokenHash: "hash:token",
    });
  });

  it("falls back to the session user when no guest token matches (claimed order)", async () => {
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "order-1" });
    await expect(
      resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "old", userId: "user-1", now }),
    ).resolves.toEqual({ userId: "user-1" });
    expect(mocks.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { orderNumber: "MS-1", userId: "user-1" } }),
    );
  });

  it("denies access when no credential owns the order", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(
      resolveCustomerOrderIdentity({ orderNumber: "MS-1", accessToken: "x", userId: "intruder", now }),
    ).resolves.toBeNull();
  });
});
