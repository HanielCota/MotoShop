"use client";

import { useActionState } from "react";

import {
  createMarketplaceCouponAction,
  createSellerCouponAction,
  type CouponActionState,
} from "../actions/coupon-actions";

const initialState: CouponActionState = {};

export function CouponForm({ ownerType }: { ownerType: "MARKETPLACE" | "SELLER" }) {
  const action = ownerType === "MARKETPLACE" ? createMarketplaceCouponAction : createSellerCouponAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
      <input
        name="code"
        required
        placeholder="Código (ex.: TRILHA10)"
        className="h-10 rounded-md border px-3 text-sm uppercase"
      />
      <select name="discountType" defaultValue="PERCENTAGE" className="h-10 rounded-md border px-3 text-sm">
        <option value="PERCENTAGE">Percentual</option>
        <option value="FIXED_AMOUNT">Valor fixo em centavos</option>
      </select>
      <input
        name="percentageBps"
        type="number"
        min="1"
        max="10000"
        placeholder="Percentual em bps (1000 = 10%)"
        className="h-10 rounded-md border px-3 text-sm"
      />
      <input
        name="fixedAmountInCents"
        type="number"
        min="1"
        placeholder="Desconto fixo em centavos"
        className="h-10 rounded-md border px-3 text-sm"
      />
      <input
        name="minimumPurchaseInCents"
        type="number"
        min="0"
        defaultValue="0"
        placeholder="Compra mínima em centavos"
        className="h-10 rounded-md border px-3 text-sm"
      />
      <input
        name="globalUsageLimit"
        type="number"
        min="1"
        placeholder="Limite total (opcional)"
        className="h-10 rounded-md border px-3 text-sm"
      />
      <input
        name="perCustomerUsageLimit"
        type="number"
        min="1"
        placeholder="Limite por cliente (opcional)"
        className="h-10 rounded-md border px-3 text-sm"
      />
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Criando..." : "Criar cupom"}
        </button>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      </div>
    </form>
  );
}
