"use client";

import { useId, useState, type HTMLInputAutoCompleteAttribute } from "react";

import { Button } from "@/components/ui/button";
import { DesignCheckbox } from "@/components/ui/design-checkbox";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { createCustomerAddressAction, type CustomerAddressActionState } from "../actions/customer-address-actions";
import { formatCep } from "../domain/brazilian-address";
import {
  customerAddressFieldErrors,
  parseCustomerAddressForm,
  type CustomerAddressFieldErrors,
} from "../schemas/customer-address";
import { useCepAutofill } from "./use-cep-autofill";
import { useServerActionState } from "@/shared/forms/server-action-submit";

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
  const [fieldErrors, setFieldErrors] = useState<CustomerAddressFieldErrors>({});
  const cep = useCepAutofill(setValues);
  const [state, formAction, pending] = useServerActionState(
    async (previousState: CustomerAddressActionState, formData: FormData) => {
      // Same schema as the server: empty or invalid fields are flagged here, without a round trip.
      const parsed = parseCustomerAddressForm(formData);
      if (!parsed.success) {
        setFieldErrors(customerAddressFieldErrors(parsed.error));
        return { error: "Confira os campos destacados." };
      }

      setFieldErrors({});
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
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    if (name === "postalCode") cep.lookup(nextValue);
  }

  return (
    <form action={formAction} noValidate className="bg-card grid gap-4 rounded-xl border p-4 sm:grid-cols-2 sm:p-6">
      <h2 className="section-title sm:col-span-2">Adicionar endereço</h2>
      <Field
        label="Nome do endereço"
        name="label"
        error={fieldErrors.label}
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
        error={fieldErrors.recipient}
        value={values.recipient}
        onChange={(value) => setValue("recipient", value)}
        autoComplete="name"
        maxLength={120}
        required
      />
      <Field
        label="CEP"
        name="postalCode"
        error={fieldErrors.postalCode}
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
        error={fieldErrors.street}
        autoComplete="address-line1"
        maxLength={160}
        value={values.street}
        onChange={(value) => setValue("street", value)}
        required
      />
      <Field
        label="Número"
        name="number"
        error={fieldErrors.number}
        inputMode="numeric"
        maxLength={20}
        value={values.number}
        onChange={(value) => setValue("number", value)}
        required
      />
      <Field
        label="Complemento (opcional)"
        name="complement"
        error={fieldErrors.complement}
        autoComplete="address-line2"
        maxLength={80}
        value={values.complement}
        onChange={(value) => setValue("complement", value)}
      />
      <Field
        label="Bairro"
        name="neighborhood"
        error={fieldErrors.neighborhood}
        autoComplete="address-level3"
        maxLength={100}
        value={values.neighborhood}
        onChange={(value) => setValue("neighborhood", value)}
        required
      />
      <Field
        label="Cidade"
        name="city"
        error={fieldErrors.city}
        autoComplete="address-level2"
        maxLength={100}
        value={values.city}
        onChange={(value) => setValue("city", value)}
        required
      />
      <Field
        label="UF"
        name="state"
        error={fieldErrors.state}
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
        <Button pending={pending} pendingLabel="Salvando…" type="submit" className="w-fit font-semibold">
          Salvar endereço
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  error,
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
  error?: string | undefined;
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
  return (
    <FormField id={id} label={label} hint={hint} hintLive error={error}>
      {(control) => (
        <Input
          {...control}
          name={name}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          required={required}
        />
      )}
    </FormField>
  );
}
