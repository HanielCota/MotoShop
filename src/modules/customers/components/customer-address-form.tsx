"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DesignCheckbox } from "@/components/ui/design-checkbox";

import { useActionState } from "react";
import { useState } from "react";

import { createCustomerAddressAction, type CustomerAddressActionState } from "../actions/customer-address-actions";

const initialState: CustomerAddressActionState = {};
const emptyAddress = {
  label: "",
  recipient: "",
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

export function CustomerAddressForm() {
  const [values, setValues] = useState(emptyAddress);
  const [isDefault, setIsDefault] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previousState: CustomerAddressActionState, formData: FormData) => {
      const result = await createCustomerAddressAction(previousState, formData);
      if (result.success) {
        setValues(emptyAddress);
        setIsDefault(false);
      }
      return result;
    },
    initialState,
  );

  function setValue(name: keyof typeof emptyAddress, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  return (
    <form action={formAction} className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 sm:p-6">
      <h2 className="text-lg font-semibold sm:col-span-2">Adicionar endereço</h2>
      <Field
        label="Nome do endereço"
        name="label"
        placeholder="Casa, oficina..."
        value={values.label}
        onChange={(value) => setValue("label", value)}
        required
      />
      <Field
        label="Destinatário"
        name="recipient"
        value={values.recipient}
        onChange={(value) => setValue("recipient", value)}
        required
      />
      <Field
        label="CEP"
        name="postalCode"
        inputMode="numeric"
        value={values.postalCode}
        onChange={(value) => setValue("postalCode", value)}
        required
      />
      <Field label="Rua" name="street" value={values.street} onChange={(value) => setValue("street", value)} required />
      <Field
        label="Número"
        name="number"
        value={values.number}
        onChange={(value) => setValue("number", value)}
        required
      />
      <Field
        label="Complemento"
        name="complement"
        value={values.complement}
        onChange={(value) => setValue("complement", value)}
      />
      <Field
        label="Bairro"
        name="neighborhood"
        value={values.neighborhood}
        onChange={(value) => setValue("neighborhood", value)}
        required
      />
      <Field label="Cidade" name="city" value={values.city} onChange={(value) => setValue("city", value)} required />
      <Field
        label="UF"
        name="state"
        maxLength={2}
        value={values.state}
        onChange={(value) => setValue("state", value)}
        required
      />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <DesignCheckbox name="isDefault" checked={isDefault} onCheckedChange={setIsDefault} />
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
  value,
  onChange,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  inputMode?: "numeric";
  maxLength?: number;
  value: string;
  onChange: (value: string) => void;
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
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        required={required}
      />
    </label>
  );
}
