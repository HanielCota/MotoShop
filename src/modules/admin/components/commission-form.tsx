"use client";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { useActionState } from "react";

import {
  updateMarketplaceCommissionAction,
  type CommissionActionState,
} from "../actions/marketplace-configuration-actions";

const initialState: CommissionActionState = {};

export function CommissionForm({ defaultCommissionBps }: { defaultCommissionBps: number | null }) {
  const [state, formAction, pending] = useActionState(updateMarketplaceCommissionAction, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
        Comissão padrão (bps)
        <Input
          name="defaultCommissionBps"
          type="number"
          min="0"
          max="10000"
          required
          defaultValue={defaultCommissionBps ?? ""}
          className="h-9"
        />
      </label>
      <Button type="submit" size="sm" disabled={pending} className="rounded-md px-4">
        {pending ? "Salvando..." : "Salvar comissão"}
      </Button>
      <FormMessage error={state.error ?? null} success={state.success ?? null} />
    </form>
  );
}
