"use client";

import { useActionState } from "react";

import { updateStoreProfileAction, type StoreProfileActionState } from "../actions/store-profile-actions";

type StoreProfileFormProps = {
  store: {
    name: string;
    slug: string;
    description: string | null;
  };
};

const initialState: StoreProfileActionState = {};
const inputClassName =
  "border-input bg-background focus:ring-ring/40 h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-3";

export function StoreProfileForm({ store }: StoreProfileFormProps) {
  const [state, action, pending] = useActionState(updateStoreProfileAction, initialState);

  return (
    <form action={action} className="grid gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Nome público
        <input className={inputClassName} name="name" defaultValue={store.name} required maxLength={120} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Identificador da loja
        <input
          className={inputClassName}
          name="slug"
          defaultValue={store.slug}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          maxLength={120}
          required
          aria-describedby="store-slug-help"
        />
        <span id="store-slug-help" className="text-muted-foreground text-xs font-normal">
          URL pública: /loja/{store.slug}. Acentos e espaços são convertidos automaticamente.
        </span>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Descrição pública
        <textarea
          className="border-input bg-background focus:ring-ring/40 min-h-24 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-3"
          name="description"
          defaultValue={store.description ?? ""}
          maxLength={500}
          placeholder="Apresente sua loja para os clientes da Moto Shop."
        />
      </label>
      {state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-600" role="status">
          {state.success}
        </p>
      ) : null}
      <button
        className="bg-primary text-primary-foreground hover:bg-primary/80 h-10 rounded-md px-4 text-sm font-medium disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Salvando..." : "Salvar perfil público"}
      </button>
    </form>
  );
}
