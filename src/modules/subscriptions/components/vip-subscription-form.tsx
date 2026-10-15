"use client";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";

import { DesignSelect } from "@/components/ui/design-select";

import { activateVipSubscriptionAction, type SubscriptionActionState } from "../actions/admin-subscription-actions";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: SubscriptionActionState = {};

export function VipSubscriptionForm({
  sellers,
}: {
  sellers: Array<{ id: string; name: string; hasActiveVip: boolean }>;
}) {
  const [state, formAction, pending] = useServerActionState(activateVipSubscriptionAction, initialState);

  return (
    <form
      action={formAction}
      noValidate
      className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end"
    >
      <label className="flex flex-col gap-2 text-sm font-medium">
        Lojista
        <DesignSelect aria-label="Lojista" name="sellerId" required>
          <option value="">Selecione uma loja</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.name} {seller.hasActiveVip ? "· VIP ativo" : ""}
            </option>
          ))}
        </DesignSelect>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Duração
        <DesignSelect aria-label="Duração" name="months" defaultValue="1">
          <option value="1">1 mês</option>
          <option value="3">3 meses</option>
          <option value="6">6 meses</option>
          <option value="12">12 meses</option>
        </DesignSelect>
      </label>
      <Button pending={pending} pendingLabel="Salvando…" type="submit" className="rounded-md font-semibold">
        Ativar VIP
      </Button>
      <FormMessage error={state.error ?? null} success={state.success ?? null} className="sm:col-span-3" />
    </form>
  );
}
