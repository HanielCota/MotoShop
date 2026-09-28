"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DesignCheckbox } from "@/components/ui/design-checkbox";

import { useActionState } from "react";

import { createCustomerAddressAction, type CustomerAddressActionState } from "../actions/customer-address-actions";

const initialState: CustomerAddressActionState = {};

export function CustomerAddressForm() {
  const [state, formAction, pending] = useActionState(createCustomerAddressAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 sm:p-6">
      <h2 className="text-lg font-semibold sm:col-span-2">Adicionar endereço</h2>
      <Field label="Nome do endereço" name="label" placeholder="Casa, oficina..." required />
      <Field label="Destinatário" name="recipient" required />
      <Field label="CEP" name="postalCode" inputMode="numeric" required />
      <Field label="Rua" name="street" required />
      <Field label="Número" name="number" required />
      <Field label="Complemento" name="complement" />
      <Field label="Bairro" name="neighborhood" required />
      <Field label="Cidade" name="city" required />
      <Field label="UF" name="state" maxLength={2} required />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <DesignCheckbox name="isDefault" />
        Usar como endereço padrão
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending} className="rounded-md px-4 font-semibold">
          {pending ? "Salvando..." : "Salvar endereço"}
        </Button>
        {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  inputMode,
  maxLength,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  inputMode?: "numeric";
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <Input
        name={name}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
      />
    </label>
  );
}
