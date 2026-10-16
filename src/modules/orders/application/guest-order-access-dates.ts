import type { GuestOrderAccessDates } from "../domain/guest-order-access";

/** Dates that decide until when a guest link opens the order. */
export const guestOrderAccessSelect = {
  createdAt: true,
  sellerOrders: { select: { shipment: { select: { deliveredAt: true } } } },
} as const;

export function toGuestOrderAccessDates(order: {
  createdAt: Date;
  sellerOrders: { shipment: { deliveredAt: Date | null } | null }[];
}): GuestOrderAccessDates {
  return {
    createdAt: order.createdAt,
    deliveredAts: order.sellerOrders.map((sellerOrder) => sellerOrder.shipment?.deliveredAt ?? null),
  };
}
