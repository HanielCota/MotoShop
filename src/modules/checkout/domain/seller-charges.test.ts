import { expect, it } from "vitest";

import { calculateSellerCharges } from "./seller-charges";

const promotionEndsAt = new Date("2026-10-07T12:00:00.000Z");
const item = (sellerId: string, overrides: Partial<{ priceInCents: number; quantity: number }> = {}) => ({
  variantId: `variant-${sellerId}`,
  quantity: overrides.quantity ?? 2,
  variant: {
    priceInCents: overrides.priceInCents ?? 10_000,
    promotionalPriceInCents: 8_000,
    promotionStartsAt: null,
    promotionEndsAt,
    product: {
      sellerId,
      storeId: `store-${sellerId}`,
      store: { name: `Loja ${sellerId}` },
      seller: { commissionBpsOverride: null },
    },
  },
});
const quoteGroups = [
  { sellerId: "s1", quotes: [{ serviceCode: "pac", priceInCents: 1_500 }] },
  { sellerId: "s2", quotes: [{ serviceCode: "sedex", priceInCents: 2_000 }] },
];
const selections = { s1: "pac", s2: "sedex" };

it("prices every line at the single checkout instant and freezes the unit price on the line", () => {
  const beforeEnd = calculateSellerCharges({
    items: [item("s1")],
    quoteGroups,
    selections: { s1: "pac" },
    defaultCommissionBps: 1_000,
    now: new Date("2026-10-07T11:59:59.999Z"),
  });
  expect(beforeEnd[0]?.items[0]?.unitPriceInCents).toBe(8_000);
  expect(beforeEnd[0]?.totals.itemsSubtotalInCents).toBe(16_000);

  const afterEnd = calculateSellerCharges({
    items: [item("s1")],
    quoteGroups,
    selections: { s1: "pac" },
    defaultCommissionBps: 1_000,
    now: new Date("2026-10-07T12:00:00.001Z"),
  });
  expect(afterEnd[0]?.items[0]?.unitPriceInCents).toBe(10_000);
});

it("uses the database default commission passed by the caller unless the seller overrides it", () => {
  const charges = calculateSellerCharges({
    items: [item("s1"), item("s2")],
    quoteGroups,
    selections,
    defaultCommissionBps: 1_200,
    now: new Date("2026-10-08T00:00:00.000Z"),
  });
  expect(charges.map((charge) => charge.commissionBps)).toEqual([1_200, 1_200]);
  expect(charges[0]?.commissionInCents).toBe(2_400);
  expect(charges[0]?.sellerNetAmountInCents).toBe(20_000 - 2_400);
  expect(charges[1]?.totals.totalAmountInCents).toBe(20_000 + 2_000);
});

const marketplaceCoupon = (value: number) => ({
  discountType: "FIXED_AMOUNT" as const,
  percentageBps: null,
  fixedAmountInCents: value,
  minimumPurchaseInCents: 0,
  ownerType: "MARKETPLACE" as const,
  sellerId: null,
  fundedBy: "MARKETPLACE" as const,
});

it("fails early with a coupon message when the marketplace fee would exceed a seller's charged total", () => {
  // Subtotal 16_000 + shipping 1_500, commission 30% = 4_800; coupon leaves 17_500 - 14_000 = 3_500.
  expect(() =>
    calculateSellerCharges({
      items: [item("s1")],
      quoteGroups,
      selections: { s1: "pac" },
      coupon: marketplaceCoupon(14_000),
      defaultCommissionBps: 3_000,
      now: new Date("2026-10-07T11:00:00.000Z"),
    }),
  ).toThrow(/cupom.*Loja s1/);
});

it("accepts a marketplace coupon while the fee still fits the charged total", () => {
  const [charge] = calculateSellerCharges({
    items: [item("s1")],
    quoteGroups,
    selections: { s1: "pac" },
    coupon: marketplaceCoupon(12_700),
    defaultCommissionBps: 3_000,
    now: new Date("2026-10-07T11:00:00.000Z"),
  });
  expect(charge?.commissionInCents).toBe(4_800);
  expect(charge?.totals.totalAmountInCents).toBe(4_800);
  expect(charge?.marketplaceDiscountInCents).toBe(12_700);
});

it("requires a selected shipping quote for every seller", () => {
  expect(() =>
    calculateSellerCharges({
      items: [item("s1"), item("s2")],
      quoteGroups,
      selections: { s1: "pac" },
      defaultCommissionBps: 1_000,
      now: new Date(),
    }),
  ).toThrow("frete");
});

const percentCoupon = (owner: { ownerType: "MARKETPLACE" | "SELLER"; sellerId: string | null }, bps: number) => ({
  discountType: "PERCENTAGE" as const,
  percentageBps: bps,
  fixedAmountInCents: null,
  minimumPurchaseInCents: 0,
  ...owner,
  fundedBy: "SELLER" as const,
});
// One unit of R$ 100 (no promotion at this instant) plus R$ 15 shipping, 12% commission.
const luizScenario = (coupon?: Parameters<typeof calculateSellerCharges>[0]["coupon"]) =>
  calculateSellerCharges({
    items: [item("s1", { priceInCents: 10_000, quantity: 1 })],
    quoteGroups,
    selections: { s1: "pac" },
    coupon,
    defaultCommissionBps: 1_200,
    now: new Date("2026-10-08T00:00:00.000Z"),
  })[0];

it("charges commission on the gross items subtotal when there is no coupon, leaving shipping out", () => {
  const charge = luizScenario();

  expect(charge?.totals.totalAmountInCents).toBe(11_500);
  expect(charge?.commissionInCents).toBe(1_200);
  expect(charge?.sellerNetAmountInCents).toBe(10_000 - 1_200);
});

it("charges commission on the net value after a seller coupon (R$ 100 with 5% → base R$ 95)", () => {
  const charge = luizScenario(percentCoupon({ ownerType: "SELLER", sellerId: "s1" }, 500));

  expect(charge?.sellerDiscountInCents).toBe(500);
  expect(charge?.commissionInCents).toBe(1_140);
  expect(charge?.sellerNetAmountInCents).toBe(9_500 - 1_140);
  expect(charge?.totals.totalAmountInCents).toBe(9_500 + 1_500);
});

it("charges commission on the net value after a seller-funded Moto Shop coupon", () => {
  const charge = luizScenario(percentCoupon({ ownerType: "MARKETPLACE", sellerId: null }, 500));

  expect(charge?.sellerDiscountInCents).toBe(500);
  expect(charge?.marketplaceDiscountInCents).toBe(0);
  expect(charge?.commissionInCents).toBe(1_140);
  expect(charge?.sellerNetAmountInCents).toBe(8_360);
});

it("keeps the gross base when the marketplace pays for the discount, since the seller still sells R$ 100", () => {
  const charge = luizScenario(marketplaceCoupon(500));

  expect(charge?.marketplaceDiscountInCents).toBe(500);
  expect(charge?.commissionInCents).toBe(1_200);
  expect(charge?.sellerNetAmountInCents).toBe(8_800);
});

it("rounds the net-base commission half up in whole cents", () => {
  // 3 units of R$ 33,33 = 9_999; R$ 10 seller coupon → base 8_999; 12% = 1_079,88 → 1_080.
  const [charge] = calculateSellerCharges({
    items: [item("s1", { priceInCents: 3_333, quantity: 3 })],
    quoteGroups,
    selections: { s1: "pac" },
    coupon: { ...marketplaceCoupon(1_000), ownerType: "SELLER", sellerId: "s1", fundedBy: "SELLER" },
    defaultCommissionBps: 1_200,
    now: new Date("2026-10-08T00:00:00.000Z"),
  });

  expect(charge?.sellerDiscountInCents).toBe(1_000);
  expect(charge?.commissionInCents).toBe(1_080);
  expect(Number.isInteger(charge?.commissionInCents)).toBe(true);
});
