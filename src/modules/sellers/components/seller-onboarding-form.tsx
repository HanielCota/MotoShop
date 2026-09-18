"use client";

import { useActionState } from "react";

import { createSellerAction, type SellerActionState } from "@/modules/sellers/actions/seller-actions";

const initialState: SellerActionState = {};
const inputClassName =
  "border-input bg-background focus:ring-ring/40 h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-3";

export function SellerOnboardingForm() {
  const [state, action, pending] = useActionState(createSellerAction, initialState);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Nome da loja
        <input className={inputClassName} name="storeName" placeholder="Racing Parts" required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Identificador da loja
        <input
          className={inputClassName}
          name="storeSlug"
          placeholder="racing-parts"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        CEP de origem dos envios
        <input
          className={inputClassName}
          name="originPostalCode"
          inputMode="numeric"
          pattern="\d{8}"
          placeholder="01001000"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        Tipo de seller
        <select className={inputClassName} name="type" defaultValue="COMPANY">
          <option value="COMPANY">CNPJ / empresa</option>
          <option value="INDIVIDUAL">CPF / pessoa física</option>
        </select>
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
      <button
        className="bg-primary text-primary-foreground hover:bg-primary/80 h-10 rounded-md px-4 text-sm font-medium disabled:opacity-50 sm:col-span-2"
        disabled={pending}
      >
        {pending ? "Enviando..." : "Solicitar cadastro da loja"}
      </button>
    </form>
  );
}
