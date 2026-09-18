"use client";

import { useActionState } from "react";

import { updateMarketplaceCommissionAction, type CommissionActionState } from "../actions/marketplace-configuration-actions";

const initialState: CommissionActionState = {};

export function CommissionForm({ defaultCommissionBps }: { defaultCommissionBps: number }) {
  const [state, formAction, pending] = useActionState(updateMarketplaceCommissionAction, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
        Comissão padrão (bps)
        <input
          name="defaultCommissionBps"
          type="number"
          min="0"
          max="10000"
          defaultValue={defaultCommissionBps}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        />
      </label>
      <button disabled={pending} className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm font-medium disabled:opacity-60">
        {pending ? "Salvando..." : "Salvar comissão"}
      </button>
      {state.error ? <p className="text-destructive text-xs">{state.error}</p> : null}
      {state.success ? <p className="text-emerald-700 text-xs">{state.success}</p> : null}
    </form>
  );
}
