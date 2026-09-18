import { ApplicationError } from "@/shared/errors/application-error";

import { assertMoneyInCents, sumMoneyInCents } from "@/modules/orders/domain/money";

export type CouponDiscountDefinition = {
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  percentageBps: number | null;
  fixedAmountInCents: number | null;
  minimumPurchaseInCents: number;
};

export function calculateCouponDiscount(coupon: CouponDiscountDefinition, subtotalInCents: number): number {
  assertMoneyInCents(subtotalInCents, "subtotalInCents");
  assertMoneyInCents(coupon.minimumPurchaseInCents, "minimumPurchaseInCents");
  if (subtotalInCents < coupon.minimumPurchaseInCents) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O cupom exige um valor mínimo de compra.",
      statusCode: 409,
    });
  }

  const rawDiscountInCents =
    coupon.discountType === "PERCENTAGE"
      ? Number((BigInt(subtotalInCents) * BigInt(coupon.percentageBps ?? 0)) / BigInt(10_000))
      : (coupon.fixedAmountInCents ?? 0);
  const discount = Math.min(rawDiscountInCents, subtotalInCents);
  if (discount <= 0) {
    throw new ApplicationError({ code: "CONFLICT", message: "O cupom não gera desconto válido.", statusCode: 409 });
  }
  return discount;
}

export function allocateDiscountAcrossSubtotals(
  subtotalsInCents: readonly number[],
  discountInCents: number,
): number[] {
  const total = sumMoneyInCents(subtotalsInCents);
  assertMoneyInCents(discountInCents, "discountInCents");
  if (discountInCents > total)
    throw new ApplicationError({ code: "INVALID_MONEY", message: "Discount exceeds subtotal." });
  if (total === 0) return subtotalsInCents.map(() => 0);

  let allocated = 0;
  return subtotalsInCents.map((subtotal, index) => {
    const amount =
      index === subtotalsInCents.length - 1
        ? discountInCents - allocated
        : Number((BigInt(discountInCents) * BigInt(subtotal)) / BigInt(total));
    allocated += amount;
    return amount;
  });
}
