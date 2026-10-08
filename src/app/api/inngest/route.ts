import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { schedulePaymentRecovery, recoverPendingPayment } from "@/modules/payments/workflows/payment-recovery-workflow";
import { reconcileMercadoPagoWebhook } from "@/modules/payments/workflows/mercado-pago-webhook-workflow";
import { sendOrderPaymentNotification } from "@/modules/notifications/workflows/order-payment-notification-workflow";
import { sendSellerOrderFulfillmentNotification } from "@/modules/notifications/workflows/seller-order-fulfillment-notification-workflow";
import { dispatchPendingOutboxEventsWorkflow } from "@/modules/outbox/workflows/dispatch-outbox-workflow";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    reconcileMercadoPagoWebhook,
    sendOrderPaymentNotification,
    sendSellerOrderFulfillmentNotification,
    dispatchPendingOutboxEventsWorkflow,
    schedulePaymentRecovery,
    recoverPendingPayment,
  ],
});
