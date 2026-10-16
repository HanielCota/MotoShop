const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * M-07: the same mailbox written in different ways counts as one customer for per-customer
 * coupon limits: case is ignored, a "+tag" is dropped everywhere, and Gmail ignores dots and
 * also answers on googlemail.com. Mirrored by the SQL backfill of migration
 * 20261014100000_coupon_redemption_customer_key.
 */
export function canonicalCouponCustomerEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return normalized;

  const domain = normalized.slice(at + 1);
  const local = normalized.slice(0, at).replace(/\+.*$/, "");
  if (!GMAIL_DOMAINS.has(domain)) return `${local}@${domain}`;
  return `${local.replaceAll(".", "")}@gmail.com`;
}

/** Who is redeeming: the checkout e-mail, the signed-in user and the CPF of the order. */
export type CouponCustomer = { email: string; userId?: string | undefined; taxId?: string | undefined };
