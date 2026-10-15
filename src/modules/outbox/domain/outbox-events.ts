import { z } from "zod";

export const fulfillmentStatusChangedEventName = "motoshop/seller-order.fulfillment-status.changed" as const;
export const paymentStatusChangedEventName = "motoshop/order.payment-status.changed" as const;
export const guestOrderCreatedEventName = "motoshop/order.guest-created" as const;

export const outboxEventSchemas = {
  [fulfillmentStatusChangedEventName]: z.object({
    sellerOrderId: z.string().min(1),
    orderNumber: z.string().min(1),
    status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED"]),
    trackingCode: z.string().nullable(),
    trackingUrl: z.url().nullable(),
  }),
  [paymentStatusChangedEventName]: z.object({
    orderNumber: z.string().min(1),
    status: z.enum(["APPROVED", "FAILED", "CANCELLED"]),
    externalId: z.string().min(1),
  }),
  // No token here: the e-mail workflow rebuilds the link from the order id.
  [guestOrderCreatedEventName]: z.object({
    orderId: z.string().min(1),
    orderNumber: z.string().min(1),
  }),
} as const;

export type OutboxEventName = keyof typeof outboxEventSchemas;
export type OutboxEventPayload<Name extends OutboxEventName> = z.infer<(typeof outboxEventSchemas)[Name]>;
