import type { NextRequest } from "next/server";
import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { getInngestServeBlockReason } from "@/lib/inngest/production-guard";
import { logger } from "@/lib/logger";
import { schedulePaymentRecovery, recoverPendingPayment } from "@/modules/payments/workflows/payment-recovery-workflow";
import { reconcileMercadoPagoWebhook } from "@/modules/payments/workflows/mercado-pago-webhook-workflow";
import { sendOrderPaymentNotification } from "@/modules/notifications/workflows/order-payment-notification-workflow";
import { sendSellerOrderFulfillmentNotification } from "@/modules/notifications/workflows/seller-order-fulfillment-notification-workflow";
import { dispatchPendingOutboxEventsWorkflow } from "@/modules/outbox/workflows/dispatch-outbox-workflow";

const handlers = serve({
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

type InngestRouteHandler = (request: NextRequest, context: unknown) => Promise<Response>;

// In production the endpoint is only served in signed cloud mode: dev mode
// skips signature checks and returns stack traces in error responses.
function guarded(handler: InngestRouteHandler): InngestRouteHandler {
  return async (request, context) => {
    const reason = getInngestServeBlockReason(process.env);
    if (reason) {
      logger.error({ event: "inngest.serve_refused", reason });
      return Response.json({ error: "Service unavailable." }, { status: 503 });
    }
    return handler(request, context);
  };
}

export const GET = guarded(handlers.GET);
export const POST = guarded(handlers.POST);
export const PUT = guarded(handlers.PUT);
