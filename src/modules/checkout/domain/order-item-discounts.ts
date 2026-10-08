import { allocateDiscountAcrossSubtotals } from "@/modules/coupons/domain/coupon-discount";

/** Keep refundable item snapshots equal to the amount actually paid for items. */
export function applyOrderItemDiscounts<T extends { totalAmountInCents: number }>(lines: T[], discountInCents: number) {
  const discounts = allocateDiscountAcrossSubtotals(
    lines.map((line) => line.totalAmountInCents),
    discountInCents,
  );
  return lines.map((line, index) => ({
    ...line,
    discountAmountInCents: discounts[index]!,
    totalAmountInCents: line.totalAmountInCents - discounts[index]!,
  }));
}
