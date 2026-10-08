import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import {
  LABEL_CANCELLATION_REQUIRED_FLAG,
  hasLabelCancellationFlag,
} from "@/modules/shipping/application/shipment-operation-guard";

/**
 * Tentativas de compra/geração de etiqueta sem confirmação que exigem conferência manual e
 * etiquetas já pagas de pedidos cancelados que precisam ser canceladas no Melhor Envio.
 */
export function shipmentsNeedingReconciliationWhere(): Prisma.ShipmentWhereInput {
  const generationClaimStaleCutoff = new Date(Date.now() - 5 * 60 * 1000);
  return {
    provider: "MELHOR_ENVIO",
    OR: [
      { purchaseState: "OUTCOME_UNKNOWN", externalShipmentId: null },
      {
        purchaseState: "IN_PROGRESS",
        externalShipmentId: null,
        updatedAt: { lte: generationClaimStaleCutoff },
      },
      { generationState: "OUTCOME_UNKNOWN", externalShipmentId: { not: null } },
      {
        generationState: "IN_PROGRESS",
        externalShipmentId: { not: null },
        updatedAt: { lte: generationClaimStaleCutoff },
      },
      {
        externalShipmentId: { not: null },
        providerMetadata: { path: [LABEL_CANCELLATION_REQUIRED_FLAG], equals: true },
      },
    ],
  };
}

export async function listShipmentPurchasesNeedingReconciliation() {
  const shipments = await db.shipment.findMany({
    where: shipmentsNeedingReconciliationWhere(),
    select: {
      id: true,
      status: true,
      externalShipmentId: true,
      providerMetadata: true,
      purchaseState: true,
      purchaseError: true,
      generationState: true,
      generationError: true,
      createdAt: true,
      updatedAt: true,
      service: true,
      sellerOrder: {
        select: {
          id: true,
          storeNameSnapshot: true,
          order: { select: { orderNumber: true, customerName: true } },
        },
      },
    },
    orderBy: { updatedAt: "asc" },
    take: 100,
  });
  // O metadado bruto do provedor não é serializado para a página, só a sinalização derivada.
  return shipments.map(({ providerMetadata, ...shipment }) => ({
    ...shipment,
    labelCancellationRequired: hasLabelCancellationFlag(providerMetadata),
  }));
}
