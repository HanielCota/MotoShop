"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { claimGuestOrderAction, type ClaimGuestOrderState } from "@/modules/orders/actions/claim-guest-order-action";

const initialState: ClaimGuestOrderState = {};

export function ClaimGuestOrderForm({ orderNumber, accessToken }: { orderNumber: string; accessToken: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(claimGuestOrderAction, initialState);

  useEffect(() => {
    if (state.success) router.replace(`/orders/${encodeURIComponent(orderNumber)}`);
  }, [state.success, router, orderNumber]);

  return (
    <form
      action={action}
      className="border-info/30 bg-info-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
    >
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <input type="hidden" name="accessToken" value={accessToken} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-foreground font-medium">Salve este pedido na sua conta</p>
        <p className="text-muted-foreground text-sm">
          Depois, você poderá acompanhá-lo em Meus pedidos sem usar este link.
        </p>
        <FormMessage error={state.error ?? null} className="mt-2" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Vinculando..." : "Vincular pedido"}
      </Button>
    </form>
  );
}
