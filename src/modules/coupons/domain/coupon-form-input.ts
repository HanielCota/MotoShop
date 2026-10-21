import { parsePriceInputToCents } from "@/modules/products/domain/price-input";

import { parseCouponValidityDate } from "./coupon-validity";

/**
 * Translates the human-friendly coupon form ("10,5" %, "25,90" R$) into the persisted units
 * (basis points and cents). Both use two decimal places, so the same exact string parser applies
 * and no float is involved. Invalid text becomes NaN and is rejected by the action's schema.
 */
export function readCouponFormInput(formData: FormData) {
  const optional = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
  };
  const percent = optional("discountPercent");
  const amount = optional("discountAmount");
  const minimum = optional("minimumPurchase");

  return {
    code: formData.get("code"),
    discountType: formData.get("discountType"),
    percentageBps: percent === undefined ? undefined : parsePriceInputToCents(percent),
    fixedAmountInCents: amount === undefined ? undefined : parsePriceInputToCents(amount),
    minimumPurchaseInCents: minimum === undefined ? 0 : parsePriceInputToCents(minimum),
    globalUsageLimit: optional("globalUsageLimit"),
    perCustomerUsageLimit: optional("perCustomerUsageLimit"),
    showOnProductPage: formData.get("showOnProductPage") === "on",
    startsAt: parseCouponValidityDate(formData.get("startsAt"), "start"),
    endsAt: parseCouponValidityDate(formData.get("endsAt"), "end"),
  };
}
