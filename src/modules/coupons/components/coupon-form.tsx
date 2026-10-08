"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { DesignSelect } from "@/components/ui/design-select";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import {
  createMarketplaceCouponAction,
  createSellerCouponAction,
  type CouponActionState,
} from "../actions/coupon-actions";

const initialState: CouponActionState = {};
const emptyValues = {
  code: "",
  discountType: "PERCENTAGE",
  discountPercent: "",
  discountAmount: "",
  minimumPurchase: "",
  globalUsageLimit: "",
  perCustomerUsageLimit: "",
};

/** Amounts are typed in % and R$; the server converts them to basis points and cents. */
export function CouponForm({ ownerType }: { ownerType: "MARKETPLACE" | "SELLER" }) {
  const action = ownerType === "MARKETPLACE" ? createMarketplaceCouponAction : createSellerCouponAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [values, setValues] = useState(emptyValues);
  const percentage = values.discountType === "PERCENTAGE";

  function updateValue(name: keyof typeof emptyValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
      <FormField id={`${ownerType}-coupon-code`} label="Código do cupom" required hint="Letras, números, _ ou -.">
        {(field) => (
          <Input
            {...field}
            name="code"
            required
            autoComplete="off"
            placeholder="TRILHA10"
            className="uppercase"
            value={values.code}
            onChange={(event) => updateValue("code", event.target.value)}
          />
        )}
      </FormField>
      <FormField id={`${ownerType}-coupon-type`} label="Tipo de desconto">
        {(field) => (
          <DesignSelect
            id={field.id}
            aria-label="Tipo de desconto"
            name="discountType"
            value={values.discountType}
            onValueChange={(value) => updateValue("discountType", String(value))}
          >
            <option value="PERCENTAGE">Percentual (%)</option>
            <option value="FIXED_AMOUNT">Valor fixo (R$)</option>
          </DesignSelect>
        )}
      </FormField>
      {percentage ? (
        <FormField id={`${ownerType}-coupon-percent`} label="Desconto (%)" required hint="Ex.: 10 ou 12,5.">
          {(field) => (
            <Input
              {...field}
              name="discountPercent"
              inputMode="decimal"
              required
              placeholder="10"
              value={values.discountPercent}
              onChange={(event) => updateValue("discountPercent", event.target.value)}
            />
          )}
        </FormField>
      ) : (
        <FormField id={`${ownerType}-coupon-amount`} label="Desconto (R$)" required hint="Ex.: 25,90.">
          {(field) => (
            <Input
              {...field}
              name="discountAmount"
              inputMode="decimal"
              required
              placeholder="25,90"
              value={values.discountAmount}
              onChange={(event) => updateValue("discountAmount", event.target.value)}
            />
          )}
        </FormField>
      )}
      <FormField id={`${ownerType}-coupon-minimum`} label="Compra mínima (R$)" hint="Deixe vazio para não exigir.">
        {(field) => (
          <Input
            {...field}
            name="minimumPurchase"
            inputMode="decimal"
            placeholder="0,00"
            value={values.minimumPurchase}
            onChange={(event) => updateValue("minimumPurchase", event.target.value)}
          />
        )}
      </FormField>
      <FormField id={`${ownerType}-coupon-global-limit`} label="Limite total de usos" hint="Opcional.">
        {(field) => (
          <Input
            {...field}
            name="globalUsageLimit"
            type="number"
            inputMode="numeric"
            min="1"
            value={values.globalUsageLimit}
            onChange={(event) => updateValue("globalUsageLimit", event.target.value)}
          />
        )}
      </FormField>
      <FormField id={`${ownerType}-coupon-customer-limit`} label="Limite por cliente" hint="Opcional.">
        {(field) => (
          <Input
            {...field}
            name="perCustomerUsageLimit"
            type="number"
            inputMode="numeric"
            min="1"
            value={values.perCustomerUsageLimit}
            onChange={(event) => updateValue("perCustomerUsageLimit", event.target.value)}
          />
        )}
      </FormField>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending} className="font-semibold">
          {pending ? "Criando..." : "Criar cupom"}
        </Button>
        <FormMessage error={state.error ?? null} success={state.success ?? null} />
      </div>
    </form>
  );
}
