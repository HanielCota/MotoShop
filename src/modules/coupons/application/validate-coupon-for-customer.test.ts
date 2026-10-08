import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), count: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: { coupon: { findUnique: mocks.findUnique }, couponRedemption: { count: mocks.count } },
}));

import {
  couponCustomerUsageWhere,
  findActiveCoupon,
  getCouponAvailabilityProblem,
} from "./validate-coupon-for-customer";

const now = new Date("2026-10-07T12:00:00.000Z");
const coupon = {
  id: "coupon-1",
  active: true,
  startsAt: null,
  endsAt: null,
  globalUsageLimit: null,
  perCustomerUsageLimit: 1,
  updatedAt: now,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue(coupon);
});

it("matches previous redemptions case-insensitively on the normalized e-mail", () => {
  expect(couponCustomerUsageWhere("coupon-1", "  Buyer@Example.TEST ", "user-1")).toEqual({
    couponId: "coupon-1",
    OR: [{ customerEmailSnapshot: { equals: "buyer@example.test", mode: "insensitive" } }, { userId: "user-1" }],
  });
});

it("blocks a second use by the same customer typed with different casing", async () => {
  mocks.count.mockResolvedValue(1);
  await expect(findActiveCoupon("PROMO", "BUYER@example.test", undefined, now)).rejects.toThrow("limite");
  expect(mocks.count).toHaveBeenCalledWith({
    where: {
      couponId: "coupon-1",
      OR: [{ customerEmailSnapshot: { equals: "buyer@example.test", mode: "insensitive" } }],
    },
  });
});

it("reports expired and exhausted coupons", () => {
  expect(
    getCouponAvailabilityProblem(
      { ...coupon, endsAt: new Date("2026-10-07T11:59:59Z") },
      { globalUsage: 0, customerUsage: 0 },
      now,
    ),
  ).toBe("UNAVAILABLE");
  expect(
    getCouponAvailabilityProblem({ ...coupon, globalUsageLimit: 5 }, { globalUsage: 5, customerUsage: 0 }, now),
  ).toBe("GLOBAL_LIMIT_REACHED");
  expect(getCouponAvailabilityProblem(coupon, { globalUsage: 0, customerUsage: 0 }, now)).toBeNull();
});
