"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import {
  confirmShipmentLabelCancelledAction,
  reconcileShipmentPurchaseAction,
  type ShipmentRecoveryActionState,
} from "@/modules/admin/actions/shipment-recovery-actions";

const initialState: ShipmentRecoveryActionState = {};

export function ShipmentRecoveryForms({
  shipmentId,
  orderNumber,
  operation,
  labelCancellationRequired = false,
}: {
  shipmentId: string;
  orderNumber: string;
  operation: "PURCHASE" | "GENERATION";
  /** Etiqueta paga de pedido cancelado: exige cancelamento manual no Melhor Envio. */
  labelCancellationRequired?: boolean;
}) {
  const [purchaseState, confirmPurchase, purchasePending] = useActionState(
    reconcileShipmentPurchaseAction,
    initialState,
  );
  const [notPurchasedState, confirmNotPurchased, notPurchasedPending] = useActionState(
    reconcileShipmentPurchaseAction,
    initialState,
  );
  const [labelState, confirmLabelCancelled, labelPending] = useActionState(
    confirmShipmentLabelCancelledAction,
    initialState,
  );
  const purchase = operation === "PURCHASE";

  if (labelCancellationRequired) {
    return (
      <div className="space-y-2 rounded-lg border border-t p-4">
        <h3 className="text-sm font-semibold">Cancele a etiqueta no Melhor Envio</h3>
        <p className="text-muted-foreground text-xs">
          O pedido {orderNumber} foi cancelado com uma etiqueta já comprada. Cancele a etiqueta no painel do Melhor
          Envio da loja para que o valor seja estornado antes de qualquer postagem.
        </p>
        <form action={confirmLabelCancelled} className="space-y-3 pt-1">
          <input type="hidden" name="shipmentId" value={shipmentId} />
          <label className="block space-y-1 text-sm">
            <span>Digite {orderNumber} para confirmar que a etiqueta foi cancelada</span>
            <Input name="confirmedOrderNumber" required maxLength={40} autoComplete="off" />
          </label>
          <FormMessage error={labelState.error ?? null} success={labelState.success ?? null} />
          <Button type="submit" size="sm" disabled={labelPending}>
            {labelPending ? "Registrando…" : "Confirmar cancelamento da etiqueta"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="grid gap-4 border-t pt-4 lg:grid-cols-2">
      <form action={confirmPurchase} className="space-y-3 rounded-lg border p-4">
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <input type="hidden" name="operation" value={operation} />
        <input type="hidden" name="decision" value={purchase ? "CONFIRMED_PURCHASE" : "CONFIRMED_GENERATED"} />
        <h3 className="text-sm font-semibold">
          {purchase ? "A etiqueta aparece como comprada" : "A etiqueta aparece como gerada"}
        </h3>
        <p className="text-muted-foreground text-xs">
          Confira no Melhor Envio se a operação foi concluída para este pedido. O sistema verificará o envio na conta
          conectada e registrará a conferência.
        </p>
        {purchase ? (
          <label className="block space-y-1 text-sm">
            <span>ID da etiqueta no Melhor Envio</span>
            <Input name="externalShipmentId" required maxLength={100} autoComplete="off" />
          </label>
        ) : null}
        <label className="block space-y-1 text-sm">
          <span>Digite {orderNumber} para confirmar a conferência</span>
          <Input name="confirmedOrderNumber" required maxLength={40} autoComplete="off" />
        </label>
        <FormMessage error={purchaseState.error ?? null} success={purchaseState.success ?? null} />
        <Button type="submit" size="sm" disabled={purchasePending}>
          {purchasePending ? "Conferindo…" : purchase ? "Associar etiqueta comprada" : "Registrar etiqueta gerada"}
        </Button>
      </form>

      <form action={confirmNotPurchased} className="space-y-3 rounded-lg border p-4">
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <input type="hidden" name="operation" value={operation} />
        <input type="hidden" name="decision" value={purchase ? "CONFIRMED_NOT_PURCHASED" : "CONFIRMED_NOT_GENERATED"} />
        <h3 className="text-sm font-semibold">
          {purchase ? "Confirmei que não houve compra" : "Confirmei que a etiqueta não foi gerada"}
        </h3>
        <p className="text-muted-foreground text-xs">
          Use somente depois de conferir o pedido no Melhor Envio. Isso libera uma nova tentativa da operação.
        </p>
        <label className="block space-y-1 text-sm">
          <span>Digite {orderNumber} para liberar nova tentativa</span>
          <Input name="confirmedOrderNumber" required maxLength={40} autoComplete="off" />
        </label>
        <FormMessage error={notPurchasedState.error ?? null} success={notPurchasedState.success ?? null} />
        <Button type="submit" variant="outline" size="sm" disabled={notPurchasedPending}>
          {notPurchasedPending ? "Registrando…" : purchase ? "Registrar que não houve compra" : "Liberar nova geração"}
        </Button>
      </form>
    </div>
  );
}
