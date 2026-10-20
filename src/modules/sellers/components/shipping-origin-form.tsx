"use client";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCep } from "@/modules/customers/domain/brazilian-address";
import { formatPhone, formatTaxId, onlyDigits } from "@/modules/customers/domain/tax-id";
import { maskOnChange, type DigitMask } from "@/shared/forms/digit-mask";

import { updateShippingOriginAction, type SellerActionState } from "../actions/seller-actions";
import { useClientValidation } from "@/shared/forms/client-validation";
import { useServerActionState } from "@/shared/forms/server-action-submit";
import { validateShippingOriginForm } from "../schemas/shipping-origin";

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

/** A Brazilian phone with area code has at most 11 digits: (00) 00000-0000. */
const MAX_PHONE_DIGITS = 11;

/**
 * Phones saved before the mask existed may carry a country code (+55). Masking those would cut
 * digits and show a wrong number, so they appear as saved for the seller to fix.
 */
function savedPhoneForEditing(phone: string | null): string {
  if (phone == null) return "";
  if (onlyDigits(phone).length > MAX_PHONE_DIGITS) return phone;

  return formatPhone(phone);
}

export function ShippingOriginForm({ store }: ShippingOriginFormProps) {
  const [state, action, pending] = useServerActionState(updateShippingOriginAction, initialState);
  const { clientError, onSubmit } = useClientValidation(validateShippingOriginForm);

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome do remetente" name="originName" defaultValue={store.originName ?? ""} />
      <Field label="E-mail operacional" name="originEmail" type="email" defaultValue={store.originEmail ?? ""} />
      <Field
        label="Telefone"
        name="originPhone"
        inputMode="tel"
        mask={formatPhone}
        maxLength={15}
        defaultValue={savedPhoneForEditing(store.originPhone)}
      />
      <Field
        label="CPF ou CNPJ"
        name="originDocument"
        inputMode="numeric"
        mask={formatTaxId}
        maxLength={18}
        defaultValue={formatTaxId(store.originDocument ?? "")}
      />
      <Field
        label="CEP de origem"
        name="originPostalCode"
        inputMode="numeric"
        mask={formatCep}
        maxLength={9}
        defaultValue={formatCep(store.originPostalCode ?? "")}
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
      <FormMessage
        error={clientError ?? state.error ?? null}
        success={clientError ? null : (state.success ?? null)}
        className="sm:col-span-2"
      />
      <Button pending={pending} pendingLabel="Salvando…" type="submit" className="sm:col-span-2">
        Salvar dados de envio
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
  mask,
  required = true,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: "text" | "email";
  inputMode?: "numeric" | "tel";
  maxLength?: number;
  /** Formats the value while typing; the server keeps reading only the digits. */
  mask?: DigitMask;
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
        onChange={mask ? maskOnChange(mask) : undefined}
        required={required}
      />
    </label>
  );
}
