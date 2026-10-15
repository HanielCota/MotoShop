import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    coupon: { findFirst: vi.fn(), update: vi.fn() },
    couponSellerParticipation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { tx, transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
});

vi.mock("@/lib/database", () => ({ db: { $transaction: mocks.transaction } }));

import { setCouponParticipation } from "./set-coupon-participation";

const openCampaign = { id: "coupon-1", code: "TRILHA10", active: true, endsAt: null };
const input = { sellerId: "seller-a", userId: "user-a", couponId: "coupon-1" };
const { tx } = mocks;

beforeEach(() => {
  vi.clearAllMocks();
  tx.coupon.findFirst.mockResolvedValue(openCampaign);
  tx.couponSellerParticipation.findUnique.mockResolvedValue(null);
});

describe("setCouponParticipation", () => {
  it("locks the campaign and only accepts marketplace coupons paid by sellers", async () => {
    await setCouponParticipation({ ...input, participate: true });

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.coupon.findFirst).toHaveBeenCalledWith({
      where: { id: "coupon-1", ownerType: "MARKETPLACE", fundedBy: "SELLER" },
      select: { id: true, code: true, active: true, endsAt: true },
    });
  });

  it("joins, bumps the coupon version and audits the seller and actor", async () => {
    expect(await setCouponParticipation({ ...input, participate: true })).toEqual({ changed: true });

    expect(tx.couponSellerParticipation.create).toHaveBeenCalledWith({
      data: { couponId: "coupon-1", sellerId: "seller-a", joinedAt: expect.any(Date) },
    });
    expect(tx.coupon.update).toHaveBeenCalledWith({ where: { id: "coupon-1" }, data: { updatedAt: expect.any(Date) } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "COUPON_CAMPAIGN_JOINED",
        entityType: "Coupon",
        entityId: "coupon-1",
        actorUserId: "user-a",
        metadata: { code: "TRILHA10", sellerId: "seller-a" },
      },
    });
  });

  it("rejoins a campaign the seller had left, keeping the same row", async () => {
    tx.couponSellerParticipation.findUnique.mockResolvedValue({ id: "part-1", leftAt: new Date("2026-10-01") });

    await setCouponParticipation({ ...input, participate: true });

    expect(tx.couponSellerParticipation.update).toHaveBeenCalledWith({
      where: { id: "part-1" },
      data: { joinedAt: expect.any(Date), leftAt: null },
    });
    expect(tx.couponSellerParticipation.create).not.toHaveBeenCalled();
  });

  it("leaves a campaign by recording leftAt instead of deleting", async () => {
    tx.couponSellerParticipation.findUnique.mockResolvedValue({ id: "part-1", leftAt: null });

    expect(await setCouponParticipation({ ...input, participate: false })).toEqual({ changed: true });

    expect(tx.couponSellerParticipation.update).toHaveBeenCalledWith({
      where: { id: "part-1" },
      data: { leftAt: expect.any(Date) },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "COUPON_CAMPAIGN_LEFT" }),
    });
  });

  it("lets the seller leave an expired campaign", async () => {
    tx.coupon.findFirst.mockResolvedValue({ ...openCampaign, active: false, endsAt: new Date("2026-01-01") });
    tx.couponSellerParticipation.findUnique.mockResolvedValue({ id: "part-1", leftAt: null });

    expect(await setCouponParticipation({ ...input, participate: false })).toEqual({ changed: true });
  });

  it.each([
    [true, { id: "part-1", leftAt: null }],
    [false, null],
    [false, { id: "part-1", leftAt: new Date("2026-10-01") }],
  ])("does nothing when participate=%s and the state already matches", async (participate, participation) => {
    tx.couponSellerParticipation.findUnique.mockResolvedValue(participation);

    expect(await setCouponParticipation({ ...input, participate })).toEqual({ changed: false });

    expect(tx.coupon.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([
    { ...openCampaign, active: false },
    { ...openCampaign, endsAt: new Date("2020-01-01") },
  ])("refuses to join a closed campaign", async (campaign) => {
    tx.coupon.findFirst.mockResolvedValue(campaign);

    await expect(setCouponParticipation({ ...input, participate: true })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(tx.couponSellerParticipation.create).not.toHaveBeenCalled();
  });

  it("refuses coupons that are not seller-funded campaigns", async () => {
    tx.coupon.findFirst.mockResolvedValue(null);

    await expect(setCouponParticipation({ ...input, participate: true })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
