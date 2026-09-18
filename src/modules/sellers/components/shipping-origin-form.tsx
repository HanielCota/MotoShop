"use client";

import { useActionState } from "react";

import { updateShippingOriginAction, type SellerActionState } from "../actions/seller-actions";

type ShippingOriginFormProps = {
  store: {
    originName: string | null;
    originEmail: string | null;
    originPhone: string | null;
    originDocument: string | null;
    originPostalCode: string | null;
    originStreet: string | null;
    originNumber: string | null;
    originComplement: string | null;
    originNeighborhood: string | null;
    originCity: string | null;
    originState: string | null;
    originStateRegister: string | null;
  };
};

const initialState: SellerActionState = {};
const inputClassName =
  "border-input bg-background focus:ring-ring/40 h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-3";

export function ShippingOriginForm({ store }: ShippingOriginFormProps) {
  const [state, action, pending] = useActionState(updateShippingOriginAction, initialState);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome do remetente" name="originName" defaultValue={store.originName ?? ""} />
      <Field label="E-mail operacional" name="originEmail" type="email" defaultValue={store.originEmail ?? ""} />
      <Field label="Telefone" name="originPhone" inputMode="tel" defaultValue={store.originPhone ?? ""} />
      <Field
        label="CPF ou CNPJ"
        name="originDocument"
        inputMode="numeric"
        defaultValue={store.originDocument ?? ""}
      />
      <Field
        label="CEP de origem"
        name="originPostalCode"
        inputMode="numeric"
        defaultValue={store.originPostalCode ?? ""}
      />
      <Field label="Rua" name="originStreet" defaultValue={store.originStreet ?? ""} />
      <Field label="Número" name="originNumber" defaultValue={store.originNumber ?? ""} />
      <Field label="Complemento" name="originComplement" defaultValue={store.originComplement ?? ""} required={false} />
      <Field label="Bairro" name="originNeighborhood" defaultValue={store.originNeighborhood ?? ""} />
      <Field label="Cidade" name="originCity" defaultValue={store.originCity ?? ""} />
      <Field label="UF" name="originState" maxLength={2} defaultValue={store.originState ?? ""} />
      <Field
        label="Inscrição estadual"
        name="originStateRegister"
        defaultValue={store.originStateRegister ?? "ISENTO"}
        required={false}
      />
      <p className="text-muted-foreground text-xs sm:col-span-2">
        Esses dados são enviados ao Melhor Envio como remetente. Para envios sem nota fiscal, use “ISENTO” quando
        aplicável.
      </p>
      {state.error ? (
        <p className="text-destructive text-sm sm:col-span-2" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-600 sm:col-span-2" role="status">
          {state.success}
        </p>
      ) : null}
      <button
        className="bg-primary text-primary-foreground hover:bg-primary/80 h-10 rounded-md px-4 text-sm font-medium disabled:opacity-50 sm:col-span-2"
        disabled={pending}
      >
        {pending ? "Salvando..." : "Salvar dados de envio"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  inputMode,
  maxLength,
  required = true,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: "text" | "email";
  inputMode?: "numeric" | "tel";
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <input
        className={inputClassName}
        name={name}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        defaultValue={defaultValue}
        required={required}
      />
    </label>
  );
}
