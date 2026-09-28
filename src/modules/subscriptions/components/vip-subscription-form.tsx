"use client";
import { Button } from "@/components/ui/button";

import { DesignSelect } from "@/components/ui/design-select";

import { useActionState } from "react";

import { activateVipSubscriptionAction, type SubscriptionActionState } from "../actions/admin-subscription-actions";

const initialState: SubscriptionActionState = {};

export function VipSubscriptionForm({
  sellers,
}: {
  sellers: Array<{ id: string; name: string; hasActiveVip: boolean }>;
}) {
  const [state, formAction, pending] = useActionState(activateVipSubscriptionAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Seller
        <DesignSelect aria-label="Seller" name="sellerId" required>
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
      <Button type="submit" disabled={pending} className="rounded-md font-semibold">
        {pending ? "Salvando..." : "Ativar VIP"}
      </Button>
      {state.error ? <p className="text-destructive text-sm sm:col-span-3">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700 sm:col-span-3">{state.success}</p> : null}
    </form>
  );
}
