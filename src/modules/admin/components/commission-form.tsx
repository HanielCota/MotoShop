"use client";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { formatPriceInputFromCents } from "@/modules/products/domain/price-input";
import { useClientValidation } from "@/shared/forms/client-validation";

import { validateDefaultCommissionForm } from "../schemas/marketplace-commission";

import {
  updateMarketplaceCommissionAction,
  type CommissionActionState,
} from "../actions/marketplace-configuration-actions";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: CommissionActionState = {};

export function CommissionForm({ defaultCommissionBps }: { defaultCommissionBps: number | null }) {
  const [state, formAction, pending] = useServerActionState(updateMarketplaceCommissionAction, initialState);
  const { clientError, onSubmit } = useClientValidation(validateDefaultCommissionForm);
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
        Comissão padrão (%)
        <Input
          name="commissionPercent"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={state.values?.commissionPercent ?? formatOptionalCommission(defaultCommissionBps)}
          placeholder="Ex.: 12,00"
          className="h-9"
        />
      </label>
      <Button type="submit" size="sm" disabled={pending} className="rounded-md px-4">
        {pending ? "Salvando..." : "Salvar comissão"}
      </Button>
      <FormMessage error={clientError ?? state.error ?? null} success={clientError ? null : (state.success ?? null)} />
    </form>
  );
}

function formatOptionalCommission(commissionBps: number | null) {
  if (commissionBps === null) return "";
  return formatPriceInputFromCents(commissionBps);
}
