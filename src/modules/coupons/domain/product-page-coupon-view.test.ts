import { expect, it } from "vitest";

import { toProductPageCouponView } from "./product-page-coupon-view";

const base = {
  code: "TRILHA10",
  discountType: "PERCENTAGE" as const,
  percentageBps: 1_000,
  fixedAmountInCents: null,
  minimumPurchaseInCents: 0,
  endsAt: null,
};

it("describes a percentage coupon without minimum or end date", () => {
  expect(toProductPageCouponView(base)).toEqual({
    code: "TRILHA10",
    discount: "10% de desconto",
    minimumPurchase: null,
    validity: "Sem data de término",
  });
});

it("keeps decimal percentages in pt-BR", () => {
  expect(toProductPageCouponView({ ...base, percentageBps: 1_050 }).discount).toBe("10,5% de desconto");
});

it("describes a fixed coupon with minimum purchase and end date in the marketplace time zone", () => {
  const view = toProductPageCouponView({
    ...base,
    discountType: "FIXED_AMOUNT",
    percentageBps: null,
    fixedAmountInCents: 2_590,
    minimumPurchaseInCents: 15_000,
    // 02:00 UTC is still 20/10 in São Paulo.
    endsAt: new Date("2026-10-21T02:00:00.000Z"),
  });

  expect(view.discount).toMatch(/^R\$\s25,90 de desconto$/);
  expect(view.minimumPurchase).toMatch(/^Compra mínima de R\$\s150,00$/);
  expect(view.validity).toBe("Válido até 20/10/2026");
});
