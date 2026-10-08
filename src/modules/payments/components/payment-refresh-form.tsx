"use client";
import { Button } from "@/components/ui/button";

import { useActionState } from "react";

import { refreshPendingPaymentAction, type PaymentActionState } from "../actions/payment-actions";

const initialState: PaymentActionState = {};

export function PaymentRefreshForm({ orderNumber, accessToken }: { orderNumber: string; accessToken?: string }) {
  const [state, formAction, pending] = useActionState(refreshPendingPaymentAction, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="orderNumber" value={orderNumber} />
      {accessToken ? <input type="hidden" name="accessToken" value={accessToken} /> : null}
      <Button variant="outline" type="submit" disabled={pending}>
        {pending ? "Consultando..." : "Atualizar status"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive text-xs">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-success-foreground text-xs">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
