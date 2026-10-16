"use client";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { claimGuestOrderAction, type ClaimGuestOrderState } from "@/modules/orders/actions/claim-guest-order-action";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: ClaimGuestOrderState = {};

export function ClaimGuestOrderForm({ orderNumber }: { orderNumber: string }) {
  const [state, action, pending] = useServerActionState(claimGuestOrderAction, initialState);

  return (
    <form
      action={action}
      className="border-info/30 bg-info-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
    >
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-foreground font-medium">Salve este pedido na sua conta</p>
        <p className="text-muted-foreground text-sm">
          Depois, você poderá acompanhá-lo em Meus pedidos sem usar este link.
        </p>
        <FormMessage error={state.error ?? null} className="mt-2" />
      </div>
      <Button pending={pending} pendingLabel="Vinculando…" type="submit">
        Vincular pedido
      </Button>
    </form>
  );
}
