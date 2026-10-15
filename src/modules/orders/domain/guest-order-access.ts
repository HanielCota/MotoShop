/** A guest order link always works for this long after the purchase. */
export const GUEST_ORDER_ACCESS_DAYS_AFTER_ORDER = 180;
/** And for this long after the last delivery, so returns and disputes stay possible. */
export const GUEST_ORDER_ACCESS_DAYS_AFTER_DELIVERY = 90;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type GuestOrderAccessDates = {
  createdAt: Date;
  deliveredAts: (Date | null)[];
};

/** Later of "180 days after the order" and "90 days after the last delivery". */
export function getGuestOrderAccessExpiresAt(order: GuestOrderAccessDates): Date {
  const fromOrder = order.createdAt.getTime() + GUEST_ORDER_ACCESS_DAYS_AFTER_ORDER * DAY_IN_MS;
  const deliveries = order.deliveredAts.filter((date): date is Date => date !== null).map((date) => date.getTime());
  const fromDelivery =
    deliveries.length > 0 ? Math.max(...deliveries) + GUEST_ORDER_ACCESS_DAYS_AFTER_DELIVERY * DAY_IN_MS : 0;

  return new Date(Math.max(fromOrder, fromDelivery));
}

export function isGuestOrderAccessExpired(order: GuestOrderAccessDates, now: Date): boolean {
  return now.getTime() > getGuestOrderAccessExpiresAt(order).getTime();
}
