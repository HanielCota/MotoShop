"use client";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DesignSelect } from "@/components/ui/design-select";

import { useActionState, useState } from "react";

import {
  createMarketplaceCouponAction,
  createSellerCouponAction,
  type CouponActionState,
} from "../actions/coupon-actions";

const initialState: CouponActionState = {};
const emptyValues = {
  code: "",
  discountType: "PERCENTAGE",
  percentageBps: "",
  fixedAmountInCents: "",
  minimumPurchaseInCents: "0",
  globalUsageLimit: "",
  perCustomerUsageLimit: "",
};

export function CouponForm({ ownerType }: { ownerType: "MARKETPLACE" | "SELLER" }) {
  const action = ownerType === "MARKETPLACE" ? createMarketplaceCouponAction : createSellerCouponAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [values, setValues] = useState(emptyValues);

  function updateValue(name: keyof typeof emptyValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
      <Input
        name="code"
        required
        placeholder="Código (ex.: TRILHA10)"
        className="uppercase"
        value={values.code}
        onChange={(event) => updateValue("code", event.target.value)}
      />
      <DesignSelect
        aria-label="Tipo de desconto"
        name="discountType"
        value={values.discountType}
        onValueChange={(value) => updateValue("discountType", String(value))}
      >
        <option value="PERCENTAGE">Percentual</option>
        <option value="FIXED_AMOUNT">Valor fixo em centavos</option>
      </DesignSelect>
      <Input
        name="percentageBps"
        type="number"
        min="1"
        max="10000"
        placeholder="Percentual em bps (1000 = 10%)"
        value={values.percentageBps}
        onChange={(event) => updateValue("percentageBps", event.target.value)}
      />
      <Input
        name="fixedAmountInCents"
        type="number"
        min="1"
        placeholder="Desconto fixo em centavos"
        value={values.fixedAmountInCents}
        onChange={(event) => updateValue("fixedAmountInCents", event.target.value)}
      />
      <Input
        name="minimumPurchaseInCents"
        type="number"
        min="0"
        placeholder="Compra mínima em centavos"
        value={values.minimumPurchaseInCents}
        onChange={(event) => updateValue("minimumPurchaseInCents", event.target.value)}
      />
      <Input
        name="globalUsageLimit"
        type="number"
        min="1"
        placeholder="Limite total (opcional)"
        value={values.globalUsageLimit}
        onChange={(event) => updateValue("globalUsageLimit", event.target.value)}
      />
      <Input
        name="perCustomerUsageLimit"
        type="number"
        min="1"
        placeholder="Limite por cliente (opcional)"
        value={values.perCustomerUsageLimit}
        onChange={(event) => updateValue("perCustomerUsageLimit", event.target.value)}
      />
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending} className="font-semibold">
          {pending ? "Criando..." : "Criar cupom"}
        </Button>
        <FormMessage error={state.error ?? null} success={state.success ?? null} />
      </div>
    </form>
  );
}
