import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn(), auditCreate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => {
  const tx = { order: { updateMany: mocks.updateMany }, auditLog: { create: mocks.auditCreate } };
  return {
    db: {
      order: { findFirst: mocks.findFirst },
      $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    },
  };
});

import { claimGuestOrder } from "./claim-guest-order";

const input = {
  orderNumber: "MS-100",
  guestAccessTokenHash: "hash:secure-guest-token",
  userId: "user-a",
  userEmail: "buyer@example.test",
  userEmailVerified: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findFirst.mockResolvedValue({
    id: "order-a",
    customerEmail: "Buyer@Example.Test",
    createdAt: new Date(),
    sellerOrders: [],
  });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("claim guest order", () => {
  it("requires the token hash and an unclaimed order, then revokes the guest link atomically", async () => {
    await expect(claimGuestOrder(input)).resolves.toEqual({ orderNumber: "MS-100" });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { orderNumber: "MS-100", guestAccessTokenHash: "hash:secure-guest-token", userId: null },
      select: expect.objectContaining({ id: true, customerEmail: true, createdAt: true }),
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "order-a", userId: null, guestAccessTokenHash: "hash:secure-guest-token" },
      data: { userId: "user-a", guestAccessTokenHash: null },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "ORDER_GUEST_CLAIMED", entityId: "order-a", actorUserId: "user-a" }),
    });
  });

  it("rejects an account whose e-mail is not verified", async () => {
    await expect(claimGuestOrder({ ...input, userEmailVerified: false })).rejects.toThrow(/Confirme o e-mail/);
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a different account email without mutating the order", async () => {
    await expect(claimGuestOrder({ ...input, userEmail: "other@example.test" })).rejects.toThrow(/mesmo e-mail/);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("refuses an expired guest link", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "order-a",
      customerEmail: "buyer@example.test",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      sellerOrders: [],
    });
    await expect(claimGuestOrder(input)).rejects.toThrow(/não encontrado/);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("does not overwrite a claim won by another concurrent request", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(claimGuestOrder(input)).rejects.toThrow(/já foi vinculado/);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
