"use client";
import { Button } from "@/components/ui/button";

import { refreshPendingPaymentAction, type PaymentActionState } from "../actions/payment-actions";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: PaymentActionState = {};

export function PaymentRefreshForm({ orderNumber }: { orderNumber: string }) {
  const [state, formAction, pending] = useServerActionState(refreshPendingPaymentAction, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="orderNumber" value={orderNumber} />
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
