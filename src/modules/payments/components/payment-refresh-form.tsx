"use client";

import { useActionState } from "react";

import { refreshPendingPaymentAction, type PaymentActionState } from "../actions/payment-actions";

const initialState: PaymentActionState = {};

export function PaymentRefreshForm({ orderNumber, accessToken }: { orderNumber: string; accessToken?: string }) {
  const [state, formAction, pending] = useActionState(refreshPendingPaymentAction, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="orderNumber" value={orderNumber} />
      {accessToken ? <input type="hidden" name="accessToken" value={accessToken} /> : null}
      <button
        type="submit"
        disabled={pending}
        className="border-border hover:bg-muted rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Consultando..." : "Atualizar status"}
      </button>
      {state.error ? <p className="text-destructive text-xs">{state.error}</p> : null}
      {state.success ? <p className="text-emerald-700 text-xs">{state.success}</p> : null}
    </form>
  );
}
