import { NonRetriableError } from "inngest";
import { z } from "zod";

import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";
import { sendNotificationEmail } from "@/modules/notifications/application/send-notification-email";
import { FulfillmentStatusEmail } from "@/modules/notifications/emails/fulfillment-status-email";

const fulfillmentEventSchema = z.object({
  sellerOrderId: z.string().min(1),
  orderNumber: z.string().min(1),
  status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED"]),
  trackingCode: z.string().nullable(),
  trackingUrl: z.url().nullable(),
});

export const sendSellerOrderFulfillmentNotification = inngest.createFunction(
  {
    id: "send-seller-order-fulfillment-notification",
    retries: 3,
    triggers: [{ event: "motoshop/seller-order.fulfillment-status.changed" }],
  },
  async ({ event, step }) => {
    const parsed = fulfillmentEventSchema.safeParse(event.data);
    if (!parsed.success) throw new NonRetriableError("Invalid fulfillment notification event.");

    const sellerOrder = await step.run("load-seller-order-for-fulfillment-notification", () =>
      db.sellerOrder.findFirst({
        where: { id: parsed.data.sellerOrderId, order: { orderNumber: parsed.data.orderNumber } },
        select: {
          id: true,
          storeNameSnapshot: true,
          order: {
            select: {
              customerName: true,
              customerEmail: true,
              orderNumber: true,
              user: { select: { emailOrderUpdatesEnabled: true } },
            },
          },
        },
      }),
    );
    if (!sellerOrder) throw new NonRetriableError("Seller order not found for fulfillment notification.");
    if (sellerOrder.order.user && !sellerOrder.order.user.emailOrderUpdatesEnabled) {
      return { status: "SKIPPED", reason: "CUSTOMER_DISABLED_ORDER_EMAILS" };
    }

    const statusLabel =
      parsed.data.status === "PROCESSING" ? "em preparação" : parsed.data.status === "SHIPPED" ? "enviado" : "entregue";
    return step.run("send-fulfillment-status-email", () =>
      sendNotificationEmail({
        eventKey: `seller-order-fulfillment:${sellerOrder.id}:${parsed.data.status}`,
        kind: `SELLER_ORDER_${parsed.data.status}`,
        to: sellerOrder.order.customerEmail,
        subject: `Pedido ${statusLabel} · ${sellerOrder.order.orderNumber}`,
        react: (
          <FulfillmentStatusEmail
            customerName={sellerOrder.order.customerName}
            orderNumber={sellerOrder.order.orderNumber}
            storeName={sellerOrder.storeNameSnapshot}
            status={parsed.data.status}
            trackingCode={parsed.data.trackingCode}
            trackingUrl={parsed.data.trackingUrl}
          />
        ),
      }),
    );
  },
);
