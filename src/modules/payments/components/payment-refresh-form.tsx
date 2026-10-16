"use client";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";

import { refreshPendingPaymentAction, type PaymentActionState } from "../actions/payment-actions";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: PaymentActionState = {};

export function PaymentRefreshForm({ orderNumber }: { orderNumber: string }) {
  const [state, formAction, pending] = useServerActionState(refreshPendingPaymentAction, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <Button pending={pending} pendingLabel="Consultando…" variant="outline" type="submit">
        Atualizar status
      </Button>
      <FormMessage variant="inline" error={state.error ?? null} success={state.success ?? null} className="text-xs" />
    </form>
  );
}
