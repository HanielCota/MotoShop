import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findProduct: vi.fn(), findCoupons: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: { product: { findFirst: mocks.findProduct }, coupon: { findMany: mocks.findCoupons } },
}));

import { listProductPageCoupons } from "./product-page-coupons";

const productId = "cmf8w8m4p0000s6o5zj2q8v3k";

function coupon(code: string, limits: { globalUsageLimit: number | null; redemptions: number }) {
  return {
    code,
    discountType: "PERCENTAGE",
    percentageBps: 1000,
    fixedAmountInCents: null,
    minimumPurchaseInCents: 5000,
    endsAt: null,
    globalUsageLimit: limits.globalUsageLimit,
    _count: { redemptions: limits.redemptions },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findProduct.mockResolvedValue({ sellerId: "seller-a" });
});

it("returns only the public fields of the store coupons chosen for the product page", async () => {
  mocks.findCoupons.mockResolvedValue([coupon("TRILHA10", { globalUsageLimit: 100, redemptions: 3 })]);

  const coupons = await listProductPageCoupons(productId);

  expect(coupons).toEqual([
    {
      code: "TRILHA10",
      discountType: "PERCENTAGE",
      percentageBps: 1000,
      fixedAmountInCents: null,
      minimumPurchaseInCents: 5000,
      endsAt: null,
    },
  ]);
  expect(mocks.findCoupons).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        ownerType: "SELLER",
        sellerId: "seller-a",
        showOnProductPage: true,
        active: true,
      }),
    }),
  );
});

it("hides coupons that already reached their total usage limit", async () => {
  mocks.findCoupons.mockResolvedValue([
    coupon("ESGOTADO", { globalUsageLimit: 2, redemptions: 2 }),
    coupon("LIVRE", { globalUsageLimit: null, redemptions: 40 }),
  ]);

  expect((await listProductPageCoupons(productId)).map((item) => item.code)).toEqual(["LIVRE"]);
});

it("returns nothing for a product that is not public", async () => {
  mocks.findProduct.mockResolvedValue(null);

  expect(await listProductPageCoupons(productId)).toEqual([]);
  expect(mocks.findCoupons).not.toHaveBeenCalled();
});
