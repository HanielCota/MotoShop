"use client";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DesignSelect } from "@/components/ui/design-select";

import { useActionState } from "react";

import { createSellerAction, type SellerActionState } from "@/modules/sellers/actions/seller-actions";
import { STORE_SLUG_EXAMPLE } from "@/modules/sellers/schemas/store-slug";

const initialState: SellerActionState = {};

export function SellerOnboardingForm() {
  const [state, action, pending] = useActionState(createSellerAction, initialState);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Nome da loja
        <Input name="storeName" placeholder="Racing Parts" required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Identificador da loja
        <Input
          name="storeSlug"
          placeholder="racing-parts"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
          aria-describedby="store-slug-help"
        />
        <span id="store-slug-help" className="text-muted-foreground text-xs font-normal">
          {STORE_SLUG_EXAMPLE}
        </span>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        CEP de origem dos envios
        <Input
          name="originPostalCode"
          inputMode="numeric"
          pattern="\d{5}-?\d{3}"
          placeholder="01001-000"
          aria-describedby="origin-postal-code-help"
          required
        />
        <span id="origin-postal-code-help" className="text-muted-foreground text-xs font-normal">
          Informe os 8 números, com ou sem hífen.
        </span>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        Tipo de lojista
        <DesignSelect aria-label="Tipo de lojista" name="type" defaultValue="COMPANY">
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
