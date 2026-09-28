"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DesignSelect } from "@/components/ui/design-select";

import { useActionState } from "react";

import { createSellerAction, type SellerActionState } from "@/modules/sellers/actions/seller-actions";

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
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        CEP de origem dos envios
        <Input
          name="originPostalCode"
          inputMode="numeric"
          pattern="\d{8}"
          placeholder="01001000"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        Tipo de seller
        <DesignSelect aria-label="Tipo de seller" name="type" defaultValue="COMPANY">
          <option value="COMPANY">CNPJ / empresa</option>
          <option value="INDIVIDUAL">CPF / pessoa física</option>
        </DesignSelect>
      </label>
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
      <Button type="submit" className="rounded-md px-4 sm:col-span-2" disabled={pending}>
        {pending ? "Enviando..." : "Solicitar cadastro da loja"}
      </Button>
    </form>
  );
}
