import "server-only";

import { db } from "@/lib/database";

import { shipmentsNeedingReconciliationWhere } from "./shipment-recovery";

export type AdminDashboardCounters = Awaited<ReturnType<typeof getAdminDashboardCounters>>;

/** Contadores do painel administrativo: tudo que aguarda ação de um administrador. */
export async function getAdminDashboardCounters() {
  const [
    pendingSellers,
    submittedProducts,
    requestedCancellations,
    requestedReturns,
    openDisputes,
    failedWebhooks,
    failedNotifications,
    failedOutboxEvents,
    shipmentsNeedingReconciliation,
  ] = await Promise.all([
    db.seller.count({ where: { status: "PENDING" } }),
    db.product.count({ where: { status: "SUBMITTED" } }),
    db.cancellationRequest.count({ where: { status: "REQUESTED" } }),
    db.returnRequest.count({ where: { status: "REQUESTED" } }),
    db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    db.webhookEvent.count({ where: { status: "FAILED" } }),
    db.notificationDelivery.count({ where: { status: "FAILED" } }),
    db.outboxEvent.count({ where: { status: "FAILED" } }),
    db.shipment.count({ where: shipmentsNeedingReconciliationWhere() }),
  ]);

  return {
    pendingSellers,
    submittedProducts,
    requestedCancellations,
    requestedReturns,
    openDisputes,
    failedWebhooks,
    failedNotifications,
    failedOutboxEvents,
    shipmentsNeedingReconciliation,
  };
}
