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

it("matches the canonical e-mail, the legacy e-mail, the user and the order CPF (M-07)", () => {
  expect(
    couponCustomerUsageWhere("coupon-1", {
      email: "  Bu.yer+promo@GMAIL.com ",
      userId: "user-1",
      taxId: "52998224725",
    }),
  ).toEqual({
    couponId: "coupon-1",
    OR: [
      { customerEmailKey: "buyer@gmail.com" },
      { customerEmailSnapshot: { equals: "bu.yer+promo@gmail.com", mode: "insensitive" } },
      { userId: "user-1" },
      { order: { customerTaxId: "52998224725" } },
    ],
  });
});

it("blocks a second use by the same customer typed with different casing", async () => {
  mocks.count.mockResolvedValue(1);
  await expect(findActiveCoupon("PROMO", { email: "BUYER@example.test" }, now)).rejects.toThrow("limite");
  expect(mocks.count).toHaveBeenCalledWith({
    where: {
      couponId: "coupon-1",
      OR: [
        { customerEmailKey: "buyer@example.test" },
        { customerEmailSnapshot: { equals: "buyer@example.test", mode: "insensitive" } },
      ],
    },
  });
});

it.each([
  ["a +tag", { email: "buyer+2@example.test" }, { customerEmailKey: "buyer@example.test" }],
  ["Gmail dots", { email: "b.u.y.e.r@gmail.com" }, { customerEmailKey: "buyer@gmail.com" }],
  [
    "the same CPF with another e-mail",
    { email: "other@example.test", taxId: "52998224725" },
    { order: { customerTaxId: "52998224725" } },
  ],
])("looks up %s as the same customer (M-07)", async (_case, customer, expectedMatch) => {
  mocks.count.mockResolvedValue(0);

  await findActiveCoupon("PROMO", customer, now);

  expect(mocks.count).toHaveBeenCalledWith({
    where: expect.objectContaining({ couponId: "coupon-1", OR: expect.arrayContaining([expectedMatch]) }),
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
