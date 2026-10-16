import "server-only";

import { db } from "@/lib/database";

import { UNRESOLVED_PAYMENT_ALERT_MS } from "../domain/unresolved-payment";

/**
 * L-09: pending Mercado Pago charges without a provider id, older than the alert threshold, on
 * orders still waiting for payment. Only a person can decide them (the provider never confirmed
 * nor refused); meant for an Admin queue. Admin access is checked by the caller.
 */
export async function listLongUnresolvedPayments(now = new Date(), take = 50) {
  return db.payment.findMany({
    where: {
      provider: "MERCADO_PAGO",
      externalId: null,
      status: { in: ["PENDING", "PROCESSING"] },
      order: { status: "PENDING_PAYMENT" },
      createdAt: { lt: new Date(now.getTime() - UNRESOLVED_PAYMENT_ALERT_MS) },
    },
    orderBy: { createdAt: "asc" },
    take,
    select: {
      id: true,
      amountInCents: true,
      createdAt: true,
      order: { select: { orderNumber: true } },
    },
  });
}
