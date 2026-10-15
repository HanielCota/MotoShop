import type { CouponCustomer } from "@/modules/coupons/domain/coupon-customer-key";

/** The customer a per-customer coupon limit counts: checkout e-mail, signed-in user and CPF (M-07). */
export function couponCustomerOf(
  data: { customerEmail: string; customerTaxId?: string | undefined },
  userId: string | undefined,
): CouponCustomer {
  return { email: data.customerEmail, userId, taxId: data.customerTaxId || undefined };
}
