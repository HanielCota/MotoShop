"use client";

import { useActionState, useId, useState, type HTMLInputAutoCompleteAttribute } from "react";

import { Button } from "@/components/ui/button";
import { DesignCheckbox } from "@/components/ui/design-checkbox";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { createCustomerAddressAction, type CustomerAddressActionState } from "../actions/customer-address-actions";
import { formatCep } from "../domain/brazilian-address";
import { useCepAutofill } from "./use-cep-autofill";

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
type AddressValues = typeof emptyAddress;

export function CustomerAddressForm() {
  const [values, setValues] = useState<AddressValues>(emptyAddress);
  const [isDefault, setIsDefault] = useState(false);
  const cep = useCepAutofill(setValues);
  const [state, formAction, pending] = useActionState(
    async (previousState: CustomerAddressActionState, formData: FormData) => {
      const result = await createCustomerAddressAction(previousState, formData);
      if (result.success) {
        setValues(emptyAddress);
        setIsDefault(false);
        cep.reset();
      }
      return result;
    },
    initialState,
  );

  function setValue(name: keyof AddressValues, value: string) {
    const nextValue = name === "postalCode" ? formatCep(value) : name === "state" ? value.toUpperCase() : value;
    setValues((current) => ({ ...current, [name]: nextValue }));
    if (name === "postalCode") cep.lookup(nextValue);
  }

  return (
    <form action={formAction} noValidate className="bg-card grid gap-4 rounded-xl border p-4 sm:grid-cols-2 sm:p-6">
      <h2 className="text-lg font-semibold sm:col-span-2">Adicionar endereço</h2>
      <Field
        label="Nome do endereço"
        name="label"
        placeholder="Casa, oficina..."
        value={values.label}
        onChange={(value) => setValue("label", value)}
        autoComplete="off"
        maxLength={40}
        required
      />
      <Field
        label="Destinatário"
        name="recipient"
        value={values.recipient}
        onChange={(value) => setValue("recipient", value)}
        autoComplete="name"
        maxLength={120}
        required
      />
      <Field
        label="CEP"
        name="postalCode"
        inputMode="numeric"
        placeholder="00000-000"
        maxLength={9}
        autoComplete="postal-code"
        hint={cep.hint}
        value={values.postalCode}
        onChange={(value) => setValue("postalCode", value)}
        required
      />
      <Field
        label="Rua"
        name="street"
        autoComplete="address-line1"
        maxLength={160}
        value={values.street}
        onChange={(value) => setValue("street", value)}
        required
      />
      <Field
        label="Número"
        name="number"
        inputMode="numeric"
        maxLength={20}
        value={values.number}
        onChange={(value) => setValue("number", value)}
        required
      />
      <Field
        label="Complemento (opcional)"
        name="complement"
        autoComplete="address-line2"
        maxLength={80}
        value={values.complement}
        onChange={(value) => setValue("complement", value)}
      />
      <Field
        label="Bairro"
        name="neighborhood"
        autoComplete="address-level3"
        maxLength={100}
        value={values.neighborhood}
        onChange={(value) => setValue("neighborhood", value)}
        required
      />
      <Field
        label="Cidade"
        name="city"
        autoComplete="address-level2"
        maxLength={100}
        value={values.city}
        onChange={(value) => setValue("city", value)}
        required
      />
      <Field
        label="UF"
        name="state"
        autoComplete="address-level1"
        maxLength={2}
        value={values.state}
        onChange={(value) => setValue("state", value)}
        required
      />
      <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
        <DesignCheckbox name="isDefault" checked={isDefault} onCheckedChange={setIsDefault} />
        Usar como endereço padrão
      </label>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage error={state.error ?? null} success={state.success ?? null} />
        <Button type="submit" disabled={pending} className="w-fit rounded-md px-4 font-semibold">
          {pending ? "Salvando..." : "Salvar endereço"}
        </Button>
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
  autoComplete,
  hint,
  value,
  onChange,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string | undefined;
  inputMode?: "numeric" | undefined;
  maxLength?: number | undefined;
  autoComplete?: HTMLInputAutoCompleteAttribute | undefined;
  hint?: string | undefined;
  value: string;
  onChange: (value: string) => void;
  required?: boolean | undefined;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        name={name}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-describedby={hint ? hintId : undefined}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        required={required}
      />
      {hint ? (
        <p id={hintId} aria-live="polite" className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
