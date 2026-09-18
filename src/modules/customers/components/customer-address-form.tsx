"use client";

import { useActionState } from "react";

import { createCustomerAddressAction, type CustomerAddressActionState } from "../actions/customer-address-actions";

const initialState: CustomerAddressActionState = {};
const inputClassName = "border-input bg-background h-10 rounded-md border px-3 text-sm";

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
        <input type="checkbox" name="isDefault" />
        Usar como endereço padrão
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Salvando..." : "Salvar endereço"}
        </button>
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
      <input
        className={inputClassName}
        name={name}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
      />
    </label>
  );
}
