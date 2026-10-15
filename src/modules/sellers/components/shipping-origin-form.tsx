"use client";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { updateShippingOriginAction, type SellerActionState } from "../actions/seller-actions";
import { useServerActionState } from "@/shared/forms/server-action-submit";

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

export function ShippingOriginForm({ store }: ShippingOriginFormProps) {
  const [state, action, pending] = useServerActionState(updateShippingOriginAction, initialState);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome do remetente" name="originName" defaultValue={store.originName ?? ""} />
      <Field label="E-mail operacional" name="originEmail" type="email" defaultValue={store.originEmail ?? ""} />
      <Field label="Telefone" name="originPhone" inputMode="tel" defaultValue={store.originPhone ?? ""} />
      <Field label="CPF ou CNPJ" name="originDocument" inputMode="numeric" defaultValue={store.originDocument ?? ""} />
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
      <FormMessage error={state.error ?? null} success={state.success ?? null} className="sm:col-span-2" />
      <Button type="submit" className="rounded-md px-4 sm:col-span-2" disabled={pending}>
        {pending ? "Salvando..." : "Salvar dados de envio"}
      </Button>
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
      <Input
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
