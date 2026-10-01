"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  reconcileShipmentPurchaseAction,
  type ShipmentRecoveryActionState,
} from "@/modules/admin/actions/shipment-recovery-actions";

const initialState: ShipmentRecoveryActionState = {};

export function ShipmentRecoveryForms({ shipmentId, orderNumber }: { shipmentId: string; orderNumber: string }) {
  const [purchaseState, confirmPurchase, purchasePending] = useActionState(
    reconcileShipmentPurchaseAction,
    initialState,
  );
  const [notPurchasedState, confirmNotPurchased, notPurchasedPending] = useActionState(
    reconcileShipmentPurchaseAction,
    initialState,
  );

  return (
    <div className="grid gap-4 border-t pt-4 lg:grid-cols-2">
      <form action={confirmPurchase} className="space-y-3 rounded-lg border p-4">
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <input type="hidden" name="decision" value="CONFIRMED_PURCHASE" />
        <h3 className="text-sm font-semibold">A etiqueta aparece como comprada</h3>
        <p className="text-muted-foreground text-xs">
          Confira no Melhor Envio se o envio pertence a este pedido. O sistema verificará se o ID existe na conta
          conectada e salvará essa associação.
        </p>
        <label className="block space-y-1 text-sm">
          <span>ID da etiqueta no Melhor Envio</span>
          <Input name="externalShipmentId" required maxLength={100} autoComplete="off" />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Digite {orderNumber} para confirmar a conferência</span>
          <Input name="confirmedOrderNumber" required maxLength={40} autoComplete="off" />
        </label>
        {purchaseState.error ? <p className="text-destructive text-sm">{purchaseState.error}</p> : null}
        {purchaseState.success ? <p className="text-sm text-emerald-700">{purchaseState.success}</p> : null}
        <Button type="submit" size="sm" disabled={purchasePending}>
          {purchasePending ? "Conferindo…" : "Associar etiqueta comprada"}
        </Button>
      </form>

      <form action={confirmNotPurchased} className="space-y-3 rounded-lg border p-4">
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <input type="hidden" name="decision" value="CONFIRMED_NOT_PURCHASED" />
        <h3 className="text-sm font-semibold">Confirmei que não houve compra</h3>
        <p className="text-muted-foreground text-xs">
          Use somente depois de procurar o pedido no Melhor Envio e confirmar que nenhuma etiqueta foi paga. Isso libera
          uma nova tentativa de compra.
        </p>
        <label className="block space-y-1 text-sm">
          <span>Digite {orderNumber} para liberar nova tentativa</span>
          <Input name="confirmedOrderNumber" required maxLength={40} autoComplete="off" />
        </label>
        {notPurchasedState.error ? <p className="text-destructive text-sm">{notPurchasedState.error}</p> : null}
        {notPurchasedState.success ? <p className="text-sm text-emerald-700">{notPurchasedState.success}</p> : null}
        <Button type="submit" variant="outline" size="sm" disabled={notPurchasedPending}>
          {notPurchasedPending ? "Registrando…" : "Registrar que não houve compra"}
        </Button>
      </form>
    </div>
  );
}
