/** How long a Pix charge stays payable (M-06): afterwards Mercado Pago cancels it. */
export const PIX_EXPIRATION_MINUTES = 30;

const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Mercado Pago's `date_of_expiration`, in its documented format with an explicit offset
 * (yyyy-MM-ddTHH:mm:ss.SSS-03:00). Brazil has no daylight saving time since 2019, so the
 * São Paulo offset is fixed. An unpaid Pix then expires at the provider, which reports it
 * cancelled, and the existing recovery releases stock and coupon through that answer.
 */
export function pixExpirationDate(now: Date, minutes = PIX_EXPIRATION_MINUTES): string {
  const expiresAt = new Date(now.getTime() + minutes * 60 * 1000 - SAO_PAULO_OFFSET_MS);
  return expiresAt.toISOString().replace("Z", "-03:00");
}
