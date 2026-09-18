"use client";

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
        <select name="sellerId" required className="h-10 rounded-md border px-3 text-sm">
          <option value="">Selecione uma loja</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.name} {seller.hasActiveVip ? "· VIP ativo" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Duração
        <select name="months" defaultValue="1" className="h-10 rounded-md border px-3 text-sm">
          <option value="1">1 mês</option>
          <option value="3">3 meses</option>
          <option value="6">6 meses</option>
          <option value="12">12 meses</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground h-10 rounded-md px-3 text-sm font-semibold disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Ativar VIP"}
      </button>
      {state.error ? <p className="text-destructive text-sm sm:col-span-3">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700 sm:col-span-3">{state.success}</p> : null}
    </form>
  );
}
