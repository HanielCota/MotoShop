"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4"
    >
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <input type="hidden" name="accessToken" value={accessToken} />
      <div>
        <p className="font-medium text-blue-950">Salve este pedido na sua conta</p>
        <p className="text-sm text-blue-900">Depois, você poderá acompanhá-lo em Meus pedidos sem usar este link.</p>
        {state.error ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}
      </div>
      <button
        disabled={pending}
        className="rounded-md bg-blue-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Vinculando..." : "Vincular pedido"}
      </button>
    </form>
  );
}
