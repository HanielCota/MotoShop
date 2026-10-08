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

  let rawDiscountInCents: number;
  if (coupon.discountType === "PERCENTAGE") {
    const percentageBps = coupon.percentageBps;
    if (
      percentageBps === null ||
      !Number.isSafeInteger(percentageBps) ||
      percentageBps < 1 ||
      percentageBps > 10_000 ||
      coupon.fixedAmountInCents !== null
    ) {
      throw invalidCouponConfiguration();
    }
    rawDiscountInCents = Number((BigInt(subtotalInCents) * BigInt(percentageBps)) / BigInt(10_000));
  } else {
    const fixedAmountInCents = coupon.fixedAmountInCents;
    if (
      fixedAmountInCents === null ||
      !Number.isSafeInteger(fixedAmountInCents) ||
      fixedAmountInCents < 1 ||
      fixedAmountInCents > 2_147_483_647 ||
      coupon.percentageBps !== null
    ) {
      throw invalidCouponConfiguration();
    }
    rawDiscountInCents = fixedAmountInCents;
  }
  const discount = Math.min(rawDiscountInCents, subtotalInCents);
  if (discount <= 0) {
    throw new ApplicationError({ code: "CONFLICT", message: "O cupom não gera desconto válido.", statusCode: 409 });
  }
  return discount;
}

function invalidCouponConfiguration() {
  return new ApplicationError({
    code: "CONFIGURATION_ERROR",
    message: "Este cupom está configurado incorretamente. Escolha outro cupom.",
    statusCode: 503,
  });
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

  const shares = subtotalsInCents.map((subtotal, index) => {
    const numerator = BigInt(discountInCents) * BigInt(subtotal);
    return { index, amount: Number(numerator / BigInt(total)), remainder: numerator % BigInt(total) };
  });
  let remaining = discountInCents - shares.reduce((sum, share) => sum + share.amount, 0);
  // Largest remainders preserve the total without assigning more than a line's subtotal.
  const ranked = [...shares].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  for (const share of ranked) {
    if (remaining === 0) break;
    share.amount += 1;
    remaining -= 1;
  }
  return shares.map((share) => share.amount);
}
