import { PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/format";
import { AdminCard } from "@/modules/admin/components/admin-ui";
import { ShipmentRecoveryForms } from "@/modules/admin/components/shipment-recovery-forms";
import { listShipmentPurchasesNeedingReconciliation } from "@/modules/admin/queries/shipment-recovery";
import { requireAdminAccess } from "@/modules/auth/application/authorization";

export const metadata = { title: "Conferir etiquetas · Admin" };

// Estados técnicos da tentativa de compra/geração (não há domínio equivalente em status-labels).
const attemptStateLabels = {
  IN_PROGRESS: "Tentativa iniciada",
  OUTCOME_UNKNOWN: "Resultado incerto",
  GENERATED: "Etiqueta gerada",
} as const;

export default async function AdminShipmentRecoveryPage() {
  await requireAdminAccess();
  const shipments = await listShipmentPurchasesNeedingReconciliation();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        eyebrow="Operação de fretes"
        title="Conferir etiquetas"
        description="Tentativas de compra ou geração de etiqueta que terminaram sem confirmação."
      />

      <AdminCard
        id="admin-shipping-recovery"
        title="Por que estas etiquetas estão aguardando?"
        description="Uma compra ou geração pode terminar sem confirmação, mesmo que o Melhor Envio tenha recebido a solicitação. O sistema bloqueia novas tentativas até um administrador conferir o resultado."
      >
        {shipments.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="Nenhuma tentativa precisa de conferência"
            description="Quando uma etiqueta ficar sem confirmação, ela aparecerá aqui."
          />
        ) : (
          <ul aria-label="Etiquetas aguardando conferência" className="flex flex-col gap-4">
            {shipments.map((shipment) => {
              const operation = shipment.purchaseState ? "PURCHASE" : "GENERATION";
              const state = shipment.purchaseState ?? shipment.generationState;
              const error = shipment.purchaseError ?? shipment.generationError;

              return (
                <li key={shipment.id} className="space-y-4 rounded-xl border p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">Pedido {shipment.sellerOrder.order.orderNumber}</h3>
                        <Badge variant={state === "OUTCOME_UNKNOWN" ? "destructive" : "warning"}>
                          {operation === "PURCHASE" ? "Compra" : "Geração"} ·{" "}
                          {state ? attemptStateLabels[state] : "Aguardando"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm break-words">
                        {shipment.sellerOrder.storeNameSnapshot} · {shipment.sellerOrder.order.customerName} ·{" "}
                        {shipment.service}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Atualizado em {formatDateTime(shipment.updatedAt)}
                      </p>
                    </div>
                    {error ? <p className="text-muted-foreground max-w-md text-xs break-words">{error}</p> : null}
                  </div>
                  <ShipmentRecoveryForms
                    shipmentId={shipment.id}
                    orderNumber={shipment.sellerOrder.order.orderNumber}
                    operation={operation}
                    labelCancellationRequired={shipment.labelCancellationRequired}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
