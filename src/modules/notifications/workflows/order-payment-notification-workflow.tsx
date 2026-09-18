import { NonRetriableError } from "inngest";
import { z } from "zod";

import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";
import { sendNotificationEmail } from "@/modules/notifications/application/send-notification-email";
import { PaymentStatusEmail } from "@/modules/notifications/emails/payment-status-email";

const paymentStatusEventSchema = z.object({
  orderNumber: z.string().min(1),
  status: z.enum(["APPROVED", "AUTHORIZED", "FAILED", "CANCELLED"]),
  externalId: z.string().min(1),
});

export const sendOrderPaymentNotification = inngest.createFunction(
  {
    id: "send-order-payment-notification",
    retries: 3,
    triggers: [{ event: "motoshop/order.payment-status.changed" }],
  },
  async ({ event, step }) => {
    const parsed = paymentStatusEventSchema.safeParse(event.data);
    if (!parsed.success) throw new NonRetriableError("Invalid order payment notification event.");

    const order = await step.run("load-order-for-payment-notification", () =>
      db.order.findUnique({
        where: { orderNumber: parsed.data.orderNumber },
        include: { sellerOrders: { include: { items: true } } },
      }),
    );
    if (!order) throw new NonRetriableError("Order not found for payment notification.");

    const status = parsed.data.status === "AUTHORIZED" ? "APPROVED" : parsed.data.status;
    const isApproved = status === "APPROVED";
    const kind = isApproved ? "ORDER_PAYMENT_APPROVED" : "ORDER_PAYMENT_FAILED";
    const subject = isApproved
      ? `Pagamento confirmado · ${order.orderNumber}`
      : `Pagamento não aprovado · ${order.orderNumber}`;

    return step.run("send-payment-status-email", () =>
      sendNotificationEmail({
        eventKey: `order-payment:${order.id}:${status}`,
        kind,
        to: order.customerEmail,
        subject,
        react: (
          <PaymentStatusEmail
            customerName={order.customerName}
            orderNumber={order.orderNumber}
            totalAmountInCents={order.totalAmountInCents}
            status={status}
            items={order.sellerOrders.flatMap((sellerOrder) =>
              sellerOrder.items.map((item) => ({ name: item.productNameSnapshot, quantity: item.quantity })),
            )}
          />
        ),
      }),
    );
  },
);
