import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const findFirst = vi.fn();
  const updateMany = vi.fn();
  const auditCreate = vi.fn();
  const couponCreate = vi.fn();
  return {
    couponCreate,
    findFirst,
    updateMany,
    auditCreate,
    transaction: vi.fn(
      async (
        callback: (tx: {
          coupon: { findFirst: typeof findFirst; updateMany: typeof updateMany; create: typeof couponCreate };
          auditLog: { create: typeof auditCreate };
        }) => Promise<unknown>,
      ) => callback({ coupon: { findFirst, updateMany, create: couponCreate }, auditLog: { create: auditCreate } }),
    ),
    requireSellerAccess: vi.fn(),
    requireAdminAccess: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/database", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireSellerAccess: mocks.requireSellerAccess,
  requireAdminAccess: mocks.requireAdminAccess,
}));

import {
  createMarketplaceCouponAction,
  createSellerCouponAction,
  setMarketplaceCouponActiveAction,
  setSellerCouponActiveAction,
} from "./coupon-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSellerAccess.mockResolvedValue({ seller: { id: "seller-a" }, session: { user: { id: "owner-a" } } });
  mocks.requireAdminAccess.mockResolvedValue({ user: { id: "admin-a" } });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("coupon status authorization", () => {
  it("does not change a coupon absent from the current seller scope", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await setSellerCouponActiveAction("ccouponsellerb0000000002", false);

    expect(mocks.requireSellerAccess).toHaveBeenCalledWith("COUPON_MANAGE");
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "ccouponsellerb0000000002", ownerType: "SELLER", sellerId: "seller-a" },
    });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("keeps the seller scope in the atomic write and audits an actual change", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ccoupona00000000000000001", code: "OFFROAD" });

    await setSellerCouponActiveAction("ccoupona00000000000000001", false);

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "ccoupona00000000000000001", ownerType: "SELLER", sellerId: "seller-a", active: true },
      data: { active: false },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "SELLER_COUPON_DEACTIVATED",
        entityId: "ccoupona00000000000000001",
        actorUserId: "owner-a",
      }),
    });
  });

  it("does not create an audit entry when the status was already changed", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ccoupona00000000000000001", code: "OFFROAD" });
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await setSellerCouponActiveAction("ccoupona00000000000000001", false);

    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("does not touch the database when admin authorization fails", async () => {
    mocks.requireAdminAccess.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(setMarketplaceCouponActiveAction("ccoupona00000000000000001", false)).rejects.toThrow("FORBIDDEN");

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("limits an admin status change to marketplace-owned coupons", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ccouponglobal00000000003", code: "GLOBAL" });

    await setMarketplaceCouponActiveAction("ccouponglobal00000000003", true);

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "ccouponglobal00000000003", ownerType: "MARKETPLACE", sellerId: null },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "ccouponglobal00000000003", ownerType: "MARKETPLACE", sellerId: null, active: false },
      data: { active: true },
    });
  });
});

describe("coupon creation audit", () => {
  function couponForm() {
    const form = new FormData();
    form.set("code", "trilha10");
    form.set("discountType", "PERCENTAGE");
    form.set("percentageBps", "1000");
    form.set("minimumPurchaseInCents", "5000");
    return form;
  }

  it("creates a seller coupon and its audit entry in one transaction", async () => {
    mocks.couponCreate.mockResolvedValue({ id: "coupon-new" });

    const result = await createSellerCouponAction({}, couponForm());

    expect(result.success).toMatch(/TRILHA10/);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.couponCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: "TRILHA10",
        ownerType: "SELLER",
        fundedBy: "SELLER",
        sellerId: "seller-a",
      }),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "COUPON_CREATED",
        entityId: "coupon-new",
        actorUserId: "owner-a",
        metadata: expect.objectContaining({
          ownerType: "SELLER",
          fundedBy: "SELLER",
          sellerId: "seller-a",
          percentageBps: 1000,
          minimumPurchaseInCents: 5000,
        }),
      }),
    });
  });

  it("audits marketplace coupons with the admin as actor", async () => {
    mocks.couponCreate.mockResolvedValue({ id: "coupon-global-new" });

    await createMarketplaceCouponAction({}, couponForm());

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "COUPON_CREATED",
        actorUserId: "admin-a",
        metadata: expect.objectContaining({ ownerType: "MARKETPLACE", fundedBy: "MARKETPLACE", sellerId: null }),
      }),
    });
  });

  it("ignores malformed coupon ids before touching the database", async () => {
    await setSellerCouponActiveAction("not a cuid", true);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
