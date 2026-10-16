import { NonRetriableError } from "inngest";

import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";
import { sendNotificationEmail } from "@/modules/notifications/application/send-notification-email";
import { GuestOrderConfirmationEmail } from "@/modules/notifications/emails/guest-order-confirmation-email";
import { createGuestOrderLinkToken } from "@/modules/orders/infrastructure/guest-order-link-token";
import { guestOrderCreatedEventName, outboxEventSchemas } from "@/modules/outbox/domain/outbox-events";

import {
  buildGuestOrderLink,
  GUEST_ORDER_CONFIRMATION_KIND,
  guestOrderConfirmationEventKey,
} from "../domain/guest-order-confirmation";

/**
 * E-mails the guest the order link. The link token is rebuilt here from the order id and only
 * lives inside the send step: step results are stored by Inngest, so no step returns it.
 */
export const sendGuestOrderConfirmation = inngest.createFunction(
  {
    id: "send-guest-order-confirmation",
    retries: 3,
    triggers: [{ event: guestOrderCreatedEventName }],
  },
  async ({ event, step }) => {
    const parsed = outboxEventSchemas[guestOrderCreatedEventName].safeParse(event.data);
    if (!parsed.success) throw new NonRetriableError("Invalid guest order confirmation event.");

    const order = await step.run("load-guest-order-for-confirmation", () =>
      db.order.findUnique({
        where: { id: parsed.data.orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          userId: true,
          guestAccessTokenHash: true,
          customerName: true,
          customerEmail: true,
          totalAmountInCents: true,
        },
      }),
    );
    if (!order) throw new NonRetriableError("Order not found for guest confirmation.");
    // Claimed orders open from the account, and a refused card already told the customer on screen.
    if (order.userId || !order.guestAccessTokenHash || order.status === "CANCELLED") return { status: "SKIPPED" };

    return step.run("send-guest-order-confirmation-email", async () => {
      const orderLink = buildGuestOrderLink(
        getApplicationBaseUrl(),
        order.orderNumber,
        createGuestOrderLinkToken(order.id),
      );
      return sendNotificationEmail({
        eventKey: guestOrderConfirmationEventKey(order.id),
        kind: GUEST_ORDER_CONFIRMATION_KIND,
        to: order.customerEmail,
        subject: `Pedido recebido · ${order.orderNumber}`,
        react: (
          <GuestOrderConfirmationEmail
            customerName={order.customerName}
            orderNumber={order.orderNumber}
            totalAmountInCents={order.totalAmountInCents}
            orderLink={orderLink}
          />
        ),
      });
    });
  },
);
