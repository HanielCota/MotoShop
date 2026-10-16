/**
 * One confirmation per guest order: the outbox event and the e-mail delivery share this key, so the
 * e-mail is idempotent and the Admin can resend it from the notification history.
 */
export function guestOrderConfirmationEventKey(orderId: string) {
  return `order-guest-confirmation:${orderId}`;
}

export const GUEST_ORDER_CONFIRMATION_KIND = "ORDER_GUEST_CONFIRMATION";

/** The link is the access route, which swaps the token for the order cookie and drops it from the URL. */
export function buildGuestOrderLink(baseUrl: string, orderNumber: string, linkToken: string) {
  const url = new URL(`/orders/${encodeURIComponent(orderNumber)}/access`, baseUrl);
  url.searchParams.set("token", linkToken);
  return url.toString();
}
