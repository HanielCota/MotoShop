"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DesignSelect } from "@/components/ui/design-select";

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
      <Input name="code" required placeholder="Código (ex.: TRILHA10)" className="uppercase" />
      <DesignSelect aria-label="Tipo de desconto" name="discountType" defaultValue="PERCENTAGE">
        <option value="PERCENTAGE">Percentual</option>
        <option value="FIXED_AMOUNT">Valor fixo em centavos</option>
      </DesignSelect>
      <Input name="percentageBps" type="number" min="1" max="10000" placeholder="Percentual em bps (1000 = 10%)" />
      <Input name="fixedAmountInCents" type="number" min="1" placeholder="Desconto fixo em centavos" />
      <Input
        name="minimumPurchaseInCents"
        type="number"
        min="0"
        defaultValue="0"
        placeholder="Compra mínima em centavos"
      />
      <Input name="globalUsageLimit" type="number" min="1" placeholder="Limite total (opcional)" />
      <Input name="perCustomerUsageLimit" type="number" min="1" placeholder="Limite por cliente (opcional)" />
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending} className="rounded-md font-semibold">
          {pending ? "Criando..." : "Criar cupom"}
        </Button>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      </div>
    </form>
  );
}
