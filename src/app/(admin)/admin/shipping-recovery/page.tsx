import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listShipmentPurchasesNeedingReconciliation } from "@/modules/admin/queries/shipment-recovery";
import { ShipmentRecoveryForms } from "@/modules/admin/components/shipment-recovery-forms";

const stateLabels = {
  IN_PROGRESS: "Tentativa iniciada",
  OUTCOME_UNKNOWN: "Resultado incerto",
} as const;

export default async function AdminShipmentRecoveryPage() {
  const shipments = await listShipmentPurchasesNeedingReconciliation();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">Administração · Operação financeira de fretes</p>
          <h1 className="text-2xl font-semibold tracking-tight">Conferir compras de etiquetas</h1>
        </div>
        <Link
          href="/admin"
          className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors"
        >
          Voltar ao painel
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Por que estas etiquetas estão aguardando?</CardTitle>
          <CardDescription>
            A chamada ao Melhor Envio pode terminar sem confirmação mesmo que a compra tenha sido recebida. Para evitar
            cobrança duplicada, o sistema bloqueia outra tentativa até um administrador conferir o resultado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {shipments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma tentativa precisa de conferência.</p>
          ) : (
            shipments.map((shipment) => (
              <article key={shipment.id} className="space-y-4 rounded-xl border p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">Pedido {shipment.sellerOrder.order.orderNumber}</h2>
                      <Badge variant={shipment.purchaseState === "OUTCOME_UNKNOWN" ? "destructive" : "secondary"}>
                        {shipment.purchaseState ? stateLabels[shipment.purchaseState] : "Aguardando"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {shipment.sellerOrder.storeNameSnapshot} · {shipment.sellerOrder.order.customerName} ·{" "}
                      {shipment.service}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Atualizado em {shipment.updatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </p>
                  </div>
                  {shipment.purchaseError ? (
                    <p className="text-muted-foreground max-w-md text-xs">{shipment.purchaseError}</p>
                  ) : null}
                </div>
                <ShipmentRecoveryForms shipmentId={shipment.id} orderNumber={shipment.sellerOrder.order.orderNumber} />
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
