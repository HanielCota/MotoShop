"use client";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

import { DesignSelect } from "@/components/ui/design-select";

import { useRef } from "react";

import { slugify } from "@/lib/utils";

import { createSellerAction, type SellerActionState } from "@/modules/sellers/actions/seller-actions";
import { validateSellerOnboardingForm } from "@/modules/sellers/schemas/seller-onboarding";
import { STORE_SLUG_EXAMPLE } from "@/modules/sellers/schemas/store-slug";
import { useClientValidation } from "@/shared/forms/client-validation";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: SellerActionState = {};

export function SellerOnboardingForm() {
  const [state, action, pending] = useServerActionState(createSellerAction, initialState);
  const { clientError, onSubmit } = useClientValidation(validateSellerOnboardingForm);
  const slugError = clientError ? clientError.slugError : state.slugError;
  const formError = clientError ? (clientError.error ?? null) : (state.error ?? null);
  const slugInput = useRef<HTMLInputElement>(null);
  // Sugere o identificador a partir do nome até a pessoa editar o identificador à mão.
  const slugEditedByHand = useRef(false);

  function suggestSlug(storeName: string) {
    if (slugEditedByHand.current || !slugInput.current) return;
    slugInput.current.value = slugify(storeName);
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Nome da loja
        <Input
          name="storeName"
          placeholder="Racing Parts"
          defaultValue={state.values?.storeName ?? ""}
          onChange={(event) => suggestSlug(event.target.value)}
          required
        />
      </label>
      <FormField id="store-slug" label="Identificador da loja" hint={STORE_SLUG_EXAMPLE} error={slugError}>
        {(field) => (
          <Input
            {...field}
            ref={slugInput}
            name="storeSlug"
            placeholder="racing-parts"
            autoComplete="off"
            onChange={(event) => {
              slugEditedByHand.current = event.target.value !== "";
            }}
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
      <FormMessage error={formError} success={clientError ? null : (state.success ?? null)} className="sm:col-span-2" />
      <Button pending={pending} pendingLabel="Enviando…" type="submit" className="sm:col-span-2">
        Solicitar cadastro da loja
      </Button>
    </form>
  );
}
