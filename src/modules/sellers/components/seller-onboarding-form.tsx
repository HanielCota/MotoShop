"use client";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

import { DesignSelect } from "@/components/ui/design-select";

import { useActionState } from "react";

import { createSellerAction, type SellerActionState } from "@/modules/sellers/actions/seller-actions";
import { STORE_SLUG_EXAMPLE } from "@/modules/sellers/schemas/store-slug";

const initialState: SellerActionState = {};

export function SellerOnboardingForm() {
  const [state, action, pending] = useActionState(createSellerAction, initialState);

  return (
    <form action={action} noValidate className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Nome da loja
        <Input name="storeName" placeholder="Racing Parts" defaultValue={state.values?.storeName ?? ""} required />
      </label>
      <FormField id="store-slug" label="Identificador da loja" hint={STORE_SLUG_EXAMPLE} error={state.slugError}>
        {(field) => (
          <Input
            {...field}
            name="storeSlug"
            placeholder="racing-parts"
            autoComplete="off"
            defaultValue={state.values?.storeSlug ?? ""}
          />
        )}
      </FormField>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        CEP de origem dos envios
        <Input
          name="originPostalCode"
          inputMode="numeric"
          pattern="\d{5}-?\d{3}"
          placeholder="01001-000"
          defaultValue={state.values?.originPostalCode ?? ""}
          aria-describedby="origin-postal-code-help"
          required
        />
        <span id="origin-postal-code-help" className="text-muted-foreground text-xs font-normal">
          Informe os 8 números, com ou sem hífen.
        </span>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        Tipo de lojista
        <DesignSelect aria-label="Tipo de lojista" name="type" defaultValue={state.values?.type ?? "COMPANY"}>
          <option value="COMPANY">CNPJ / empresa</option>
          <option value="INDIVIDUAL">CPF / pessoa física</option>
        </DesignSelect>
      </label>
      <FormMessage error={state.error ?? null} success={state.success ?? null} className="sm:col-span-2" />
      <Button type="submit" className="rounded-md px-4 sm:col-span-2" disabled={pending}>
        {pending ? "Enviando..." : "Solicitar cadastro da loja"}
      </Button>
    </form>
  );
}
